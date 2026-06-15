import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { sanitizeChatContent } from '../utils/contentFilter'

const router = Router()
const prisma = new PrismaClient()
const maxImageBytes = 2 * 1024 * 1024
const maxTotalImageBytes = 4 * 1024 * 1024
const maxAttachments = 4
const onlineWindowMs = 90 * 1000
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const presenceByUser = new Map<string, number>()

interface ChatAttachment {
  id: string
  type: 'image'
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

function parseLimit(value: unknown) {
  const limit = Number(value || 50)
  if (!Number.isInteger(limit)) return 50
  return Math.min(Math.max(limit, 1), 100)
}

function getPresenceKey(workspaceKeyHash: string, userId: string) {
  return `${workspaceKeyHash}:${userId}`
}

function touchPresence(workspaceKeyHash: string, userId: string) {
  const now = Date.now()
  presenceByUser.set(getPresenceKey(workspaceKeyHash, userId), now)

  for (const [key, lastSeenAt] of presenceByUser.entries()) {
    if (now - lastSeenAt > onlineWindowMs * 4) {
      presenceByUser.delete(key)
    }
  }

  return now
}

function getPresence(workspaceKeyHash: string, userId: string) {
  const lastSeenAt = presenceByUser.get(getPresenceKey(workspaceKeyHash, userId)) || 0
  return {
    lastSeenAt,
    online: lastSeenAt > 0 && Date.now() - lastSeenAt <= onlineWindowMs,
  }
}

function normalizeFileName(value: unknown) {
  return String(value || 'image')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 120) || 'image'
}

function normalizeAttachments(value: unknown): ChatAttachment[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('图片附件格式不正确')
  if (value.length > maxAttachments) throw new Error(`最多只能发送 ${maxAttachments} 张图片`)

  let totalSize = 0

  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('图片附件格式不正确')
    }

    const record = item as Record<string, unknown>
    const dataUrl = String(record.dataUrl || '')
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/)

    if (!match) throw new Error('仅支持 PNG、JPG、WebP 或 GIF 图片')

    const mimeType = match[1]
    if (!allowedImageTypes.has(mimeType)) {
      throw new Error('图片类型不支持')
    }

    const size = Buffer.byteLength(match[2], 'base64')
    if (size <= 0 || size > maxImageBytes) {
      throw new Error('单张图片不能超过 2MB')
    }

    totalSize += size
    if (totalSize > maxTotalImageBytes) {
      throw new Error('单条消息图片总大小不能超过 4MB')
    }

    return {
      id: typeof record.id === 'string' && record.id ? record.id : randomUUID(),
      type: 'image',
      name: normalizeFileName(record.name),
      mimeType,
      size,
      dataUrl,
    }
  })
}

router.post('/presence', authenticateToken, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!
  const userId = req.userId!
  const lastSeenAt = touchPresence(workspaceKeyHash, userId)

  res.json({
    success: true,
    data: {
      online: true,
      lastSeenAt: new Date(lastSeenAt),
      onlineWindowSeconds: Math.floor(onlineWindowMs / 1000),
    },
  })
})

router.get('/members', authenticateToken, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!
  const currentUserId = req.userId!
  touchPresence(workspaceKeyHash, currentUserId)

  try {
    const members = await prisma.user.findMany({
      where: {
        workspaceKeyHash,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarDataUrl: true,
        isAdmin: true,
        sharedAccess: true,
        lastLogin: true,
        createdAt: true,
        _count: {
          select: {
            chatMessages: true,
          },
        },
      },
    })

    members.sort((left, right) => {
      const leftPresence = getPresence(workspaceKeyHash, left.id)
      const rightPresence = getPresence(workspaceKeyHash, right.id)

      if (left.id === currentUserId) return -1
      if (right.id === currentUserId) return 1
      if (leftPresence.online !== rightPresence.online) return leftPresence.online ? -1 : 1
      if (left.isAdmin !== right.isAdmin) return left.isAdmin ? -1 : 1

      const leftLogin = left.lastLogin ? left.lastLogin.getTime() : 0
      const rightLogin = right.lastLogin ? right.lastLogin.getTime() : 0
      return rightLogin - leftLogin || left.username.localeCompare(right.username)
    })

    res.json({
      success: true,
      data: {
        members: members.map((member) => {
          const presence = getPresence(workspaceKeyHash, member.id)

          return {
            id: member.id,
            username: member.username,
            email: member.email,
            displayName: member.displayName,
            avatarDataUrl: member.avatarDataUrl,
            isAdmin: member.isAdmin,
            sharedAccess: member.sharedAccess,
            lastLogin: member.lastLogin,
            lastSeenAt: presence.lastSeenAt ? new Date(presence.lastSeenAt) : null,
            online: presence.online,
            createdAt: member.createdAt,
            messageCount: member._count.chatMessages,
            isMe: member.id === currentUserId,
          }
        }),
      },
    })
  } catch (error) {
    console.error('获取讨论成员失败:', error)
    res.status(500).json({ error: '获取讨论成员失败' })
  }
})

router.get(
  '/messages',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('after').optional().isISO8601(),
    query('before').optional().isISO8601(),
    query('latest').optional().isBoolean(),
  ],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const workspaceKeyHash = req.workspaceKeyHash!
    const limit = parseLimit(req.query.limit)
    const after = typeof req.query.after === 'string' ? new Date(req.query.after) : null
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null
    const latest = req.query.latest === 'true'
    const isForwardPolling = Boolean(after)
    const readNewestFirst = latest || Boolean(before) || !isForwardPolling
    const createdAtRange = {
      ...(after ? { gt: after } : {}),
      ...(before ? { lt: before } : {}),
    }

    try {
      const messages = await prisma.workspaceChatMessage.findMany({
        where: {
          workspaceKeyHash,
          deleted: false,
          ...(Object.keys(createdAtRange).length > 0 ? { createdAt: createdAtRange } : {}),
        },
        orderBy: { createdAt: readNewestFirst ? 'desc' : 'asc' },
        take: isForwardPolling ? limit : limit + 1,
        select: {
          id: true,
          userId: true,
          content: true,
          attachments: true,
          masked: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              username: true,
              email: true,
              displayName: true,
              avatarDataUrl: true,
            },
          },
        },
      })
      const hasMoreOlder = !isForwardPolling && messages.length > limit
      const pageMessages = hasMoreOlder ? messages.slice(0, limit) : messages

      res.json({
        success: true,
        data: {
          messages: (readNewestFirst ? pageMessages.reverse() : pageMessages).map((message) => ({
            ...message,
            attachments: Array.isArray(message.attachments) ? message.attachments : [],
            isMine: message.userId === req.userId,
          })),
          pageInfo: {
            hasMoreOlder,
            oldestCreatedAt: pageMessages.length > 0
              ? pageMessages.reduce((oldest, message) =>
                  message.createdAt < oldest ? message.createdAt : oldest,
                pageMessages[0].createdAt)
              : null,
          },
        },
      })
    } catch (error) {
      console.error('获取聊天消息失败:', error)
      res.status(500).json({ error: '获取聊天消息失败' })
    }
  }
)

router.post(
  '/messages',
  authenticateToken,
  [
    body('content').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
    body('attachments').optional().isArray({ max: maxAttachments }),
  ],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const workspaceKeyHash = req.workspaceKeyHash!
    const userId = req.userId!
    touchPresence(workspaceKeyHash, userId)
    let attachments: ChatAttachment[] = []

    try {
      attachments = normalizeAttachments(req.body.attachments)
    } catch (error: any) {
      return res.status(400).json({ error: error.message || '图片附件不正确' })
    }

    const { content, masked } = sanitizeChatContent(String(req.body.content || ''))

    if (!content && attachments.length === 0) {
      return res.status(400).json({ error: '消息内容或图片不能为空' })
    }

    try {
      const message = await prisma.workspaceChatMessage.create({
        data: {
          workspaceKeyHash,
          userId,
          content,
          attachments: attachments as unknown as Prisma.InputJsonValue,
          masked,
        },
        select: {
          id: true,
          userId: true,
          content: true,
          attachments: true,
          masked: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              username: true,
              email: true,
              displayName: true,
              avatarDataUrl: true,
            },
          },
        },
      })

      res.status(201).json({
        success: true,
        data: {
          message: {
            ...message,
            attachments: Array.isArray(message.attachments) ? message.attachments : [],
            isMine: true,
          },
        },
      })
    } catch (error) {
      console.error('发送聊天消息失败:', error)
      res.status(500).json({ error: '发送聊天消息失败' })
    }
  }
)

router.delete('/messages/:id', authenticateToken, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!
  const userId = req.userId!
  const { id } = req.params

  try {
    const existing = await prisma.workspaceChatMessage.findFirst({
      where: { id, workspaceKeyHash, deleted: false },
      select: { userId: true },
    })

    if (!existing) {
      return res.status(404).json({ error: '消息不存在' })
    }

    if (existing.userId !== userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权删除该消息' })
    }

    await prisma.workspaceChatMessage.update({
      where: { id },
      data: { deleted: true },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('删除聊天消息失败:', error)
    res.status(500).json({ error: '删除聊天消息失败' })
  }
})

export default router

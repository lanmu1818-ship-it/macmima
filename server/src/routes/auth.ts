import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'
import jwt, { SignOptions } from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { getWorkspaceKeyHash } from '../utils/workspace'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()
const maxAvatarBytes = 256 * 1024

function normalizeDisplayName(value: unknown) {
  return String(value || '').trim().slice(0, 60)
}

function normalizeAvatarDataUrl(value: unknown) {
  const avatarDataUrl = String(value || '').trim()
  if (!avatarDataUrl) return null

  const match = avatarDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) {
    throw new Error('头像仅支持 PNG、JPG 或 WebP 图片')
  }

  const size = Buffer.byteLength(match[2], 'base64')
  if (size <= 0 || size > maxAvatarBytes) {
    throw new Error('头像不能超过 256KB')
  }

  return avatarDataUrl
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getAuthPepper(): Buffer {
  const pepper = process.env.AUTH_PEPPER || process.env.PASSWORD_PEPPER

  if (!pepper) {
    throw new Error('AUTH_PEPPER 未配置')
  }

  return Buffer.from(pepper, 'utf8')
}

function getArgon2Options() {
  return {
    algorithm: Algorithm.Argon2id,
    memoryCost: numberFromEnv('AUTH_ARGON2_MEMORY_KIB', 19_456),
    timeCost: numberFromEnv('AUTH_ARGON2_TIME_COST', 2),
    parallelism: numberFromEnv('AUTH_ARGON2_PARALLELISM', 1),
    outputLen: 32,
    secret: getAuthPepper(),
  }
}

function isArgon2Verifier(passwordHash: string): boolean {
  return passwordHash.startsWith('$argon2')
}

function safeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

async function hashPasswordVerifier(clientPasswordHash: string): Promise<string> {
  return argon2Hash(clientPasswordHash, getArgon2Options())
}

async function verifyPasswordVerifier(storedVerifier: string, clientPasswordHash: string) {
  if (isArgon2Verifier(storedVerifier)) {
    return {
      ok: await argon2Verify(storedVerifier, clientPasswordHash, getArgon2Options()),
      needsMigration: false,
    }
  }

  return {
    ok: safeEqualString(storedVerifier, clientPasswordHash),
    needsMigration: true,
  }
}

// 生成邀请码
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

function signAuthToken(
  userId: string,
  isAdmin: boolean,
  workspaceKeyHash: string,
  expiresIn: string
): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 未配置')
  }

  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  }

  return jwt.sign({ userId, isAdmin, workspaceKeyHash }, secret, options)
}

async function ensureWorkspace(workspaceKeyHash: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO workspaces (id, key_hash, name, created_by, is_active, created_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${workspaceKeyHash}, 'MacMima 工作台', NULL, 1, NOW(3), NOW(3))
    ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), updated_at = NOW(3)
  `
}

async function setWorkspaceCreator(workspaceKeyHash: string, userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE workspaces
    SET created_by = ${userId}, updated_at = NOW(3)
    WHERE key_hash = ${workspaceKeyHash}
  `
}

// 获取用户盐值，用于客户端计算登录哈希
router.post(
  '/salt',
  [body('username').notEmpty().trim()],
  async (req, res) => {
    const workspaceKeyHash = getWorkspaceKeyHash(req, res)
    if (!workspaceKeyHash) return

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username } = req.body

    try {
      const userInWorkspace = await prisma.user.findFirst({
        where: {
          workspaceKeyHash,
          OR: [{ username }, { email: username }],
        },
        select: {
          salt: true,
          isActive: true,
        },
      })
      const user =
        userInWorkspace ||
        (await prisma.user.findFirst({
          where: {
            workspaceKeyHash: null,
            OR: [{ username }, { email: username }],
          },
          select: {
            salt: true,
            isActive: true,
          },
        }))

      if (!user || !user.isActive) {
        return res.status(404).json({ error: '用户不存在' })
      }

      res.json({
        success: true,
        data: {
          salt: user.salt,
        },
      })
    } catch (error) {
      console.error('获取盐值失败:', error)
      res.status(500).json({ error: '获取盐值失败' })
    }
  }
)

// 获取当前登录用户，用于刷新管理员/共享密区权限
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarDataUrl: true,
        salt: true,
        isAdmin: true,
        sharedAccess: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return res.status(403).json({ error: '账号已被禁用或不存在' })
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarDataUrl: user.avatarDataUrl,
          salt: user.salt,
          isAdmin: user.isAdmin,
          sharedAccess: user.sharedAccess,
        },
      },
    })
  } catch (error) {
    console.error('获取当前用户失败:', error)
    res.status(500).json({ error: '获取当前用户失败' })
  }
})

router.patch(
  '/profile',
  authenticateToken,
  [
    body('displayName').optional({ values: 'falsy' }).isLength({ max: 60 }).trim(),
    body('avatarDataUrl').optional({ nullable: true }).isString(),
  ],
  async (req: AuthRequest, res) => {
    if (!req.userId) {
      return res.status(401).json({ error: '未提供认证令牌' })
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      let avatarDataUrl: string | null | undefined

      if (Object.prototype.hasOwnProperty.call(req.body, 'avatarDataUrl')) {
        try {
          avatarDataUrl = normalizeAvatarDataUrl(req.body.avatarDataUrl)
        } catch (error: any) {
          return res.status(400).json({ error: error.message || '头像格式不正确' })
        }
      }

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          displayName: normalizeDisplayName(req.body.displayName),
          ...(avatarDataUrl !== undefined ? { avatarDataUrl } : {}),
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarDataUrl: true,
          salt: true,
          isAdmin: true,
          sharedAccess: true,
        },
      })

      res.json({
        success: true,
        data: {
          user,
        },
      })
    } catch (error) {
      console.error('更新个人资料失败:', error)
      res.status(500).json({ error: '更新个人资料失败' })
    }
  }
)

// 注册
router.post(
  '/register',
  [
    body('username').isLength({ min: 3, max: 50 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('passwordHash').notEmpty(),
    body('salt').notEmpty(),
    body('inviteCode').optional(),
  ],
  async (req, res) => {
    const workspaceKeyHash = getWorkspaceKeyHash(req, res)
    if (!workspaceKeyHash) return

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, email, passwordHash, salt, inviteCode } = req.body

    try {
      // 检查是否是当前工作区的第一个用户
      const [serverUserCount, userCount] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { workspaceKeyHash },
        }),
      ])
      const isFirstUser = userCount === 0
      let invite: Awaited<ReturnType<typeof prisma.inviteCode.findFirst>> = null

      if (isFirstUser && serverUserCount > 0) {
        return res.status(403).json({
          error: '此后端已初始化，不能使用新的工作区 Key 注册。请使用已有工作区 Key 和邀请码。',
        })
      }

      if (isFirstUser) {
        await ensureWorkspace(workspaceKeyHash)
      }

      // 如果不是第一个用户，需要验证邀请码
      if (!isFirstUser) {
        if (!inviteCode) {
          return res.status(400).json({ error: '需要邀请码才能注册' })
        }

        // 验证邀请码
        invite = await prisma.inviteCode.findFirst({
          where: { code: inviteCode, workspaceKeyHash },
        })

        if (!invite) {
          return res.status(400).json({ error: '邀请码无效' })
        }

        if (!invite.isActive) {
          return res.status(400).json({ error: '邀请码已被禁用' })
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
          return res.status(400).json({ error: '邀请码已过期' })
        }

        if (invite.currentUses >= invite.maxUses) {
          return res.status(400).json({ error: '邀请码已达到使用上限' })
        }
      }

      // 检查用户是否已存在
      const existingUser = await prisma.user.findFirst({
        where: {
          workspaceKeyHash,
          OR: [{ username }, { email }],
        },
      })

      if (existingUser) {
        return res.status(400).json({ error: '用户名或邮箱已存在' })
      }

      // 创建用户
      const passwordVerifier = await hashPasswordVerifier(passwordHash)
      const user = await prisma.user.create({
        data: {
          username,
          email,
          workspaceKeyHash,
          passwordHash: passwordVerifier,
          salt,
          isAdmin: isFirstUser, // 第一个用户是管理员
          sharedAccess: isFirstUser,
          invitedBy: invite?.createdBy || null,
        },
      })

      if (isFirstUser) {
        await setWorkspaceCreator(workspaceKeyHash, user.id)
      }

      // 如果使用了邀请码，更新邀请码使用次数
      if (!isFirstUser && inviteCode) {
        await prisma.inviteCode.update({
          where: { code: inviteCode },
          data: {
            currentUses: { increment: 1 },
            usedBy: user.id,
            usedAt: new Date(),
            ...(invite && invite.currentUses + 1 >= invite.maxUses ? { isActive: false } : {}),
          },
        })
      }

      // 生成JWT
      const token = signAuthToken(
        user.id,
        user.isAdmin,
        workspaceKeyHash,
        process.env.JWT_EXPIRES_IN || '30d'
      )
      const refreshToken = signAuthToken(
        user.id,
        user.isAdmin,
        workspaceKeyHash,
        process.env.JWT_REFRESH_EXPIRES_IN || '90d'
      )

      res.status(201).json({
        success: true,
        data: {
          userId: user.id,
          token,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            avatarDataUrl: user.avatarDataUrl,
            salt: user.salt,
            isAdmin: user.isAdmin,
            sharedAccess: user.sharedAccess,
          },
        },
      })
    } catch (error) {
      console.error('注册错误:', error)
      res.status(500).json({ error: '注册失败' })
    }
  }
)

// 登录
router.post(
  '/login',
  [body('username').notEmpty(), body('passwordHash').notEmpty()],
  async (req, res) => {
    const workspaceKeyHash = getWorkspaceKeyHash(req, res)
    if (!workspaceKeyHash) return

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, passwordHash } = req.body

    try {
      // 查找用户
      const userInWorkspace = await prisma.user.findFirst({
        where: {
          workspaceKeyHash,
          OR: [{ username }, { email: username }],
        },
      })
      const user =
        userInWorkspace ||
        (await prisma.user.findFirst({
          where: {
            workspaceKeyHash: null,
            OR: [{ username }, { email: username }],
          },
        }))

      if (!user || !user.isActive) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      // 验证密码；旧用户仍可登录，登录成功后自动迁移到 Argon2id + pepper verifier。
      const passwordResult = await verifyPasswordVerifier(user.passwordHash, passwordHash)
      if (!passwordResult.ok) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      // 更新最后登录时间；旧数据第一次登录时绑定到当前工作区 Key
      const migratedPasswordHash = passwordResult.needsMigration
        ? await hashPasswordVerifier(passwordHash)
        : undefined
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          ...(migratedPasswordHash ? { passwordHash: migratedPasswordHash } : {}),
          ...(user.workspaceKeyHash ? {} : { workspaceKeyHash }),
        },
      })

      // 生成JWT
      const token = signAuthToken(
        updatedUser.id,
        updatedUser.isAdmin,
        workspaceKeyHash,
        process.env.JWT_EXPIRES_IN || '30d'
      )
      const refreshToken = signAuthToken(
        updatedUser.id,
        updatedUser.isAdmin,
        workspaceKeyHash,
        process.env.JWT_REFRESH_EXPIRES_IN || '90d'
      )

      res.json({
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            username: updatedUser.username,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            avatarDataUrl: updatedUser.avatarDataUrl,
            salt: updatedUser.salt,
            isAdmin: updatedUser.isAdmin,
            sharedAccess: updatedUser.sharedAccess,
          },
        },
      })
    } catch (error) {
      console.error('登录错误:', error)
      res.status(500).json({ error: '登录失败' })
    }
  }
)

// 登出
router.post('/logout', async (req, res) => {
  res.json({ success: true, message: '已登出' })
})

export default router

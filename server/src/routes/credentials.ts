import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// 获取凭证列表
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const { category, favorite, page = '1', limit = '20', scope } = req.query
  const userId = req.userId!
  const workspaceKeyHash = req.workspaceKeyHash!

  try {
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const where: any = {
      deleted: false,
    }

    if (scope === 'shared') {
      if (!req.sharedAccess) {
        return res.status(403).json({ error: '未开通共享密区权限' })
      }

      where.scope = 'shared'
      where.workspaceKeyHash = workspaceKeyHash
    } else if (scope === 'personal') {
      where.userId = userId
      where.scope = 'personal'
    } else {
      where.OR = [
        { userId },
        ...(req.sharedAccess
          ? [
              {
                scope: 'shared',
                workspaceKeyHash,
              },
            ]
          : []),
      ]
    }

    if (category) {
      where.category = category
    }

    if (favorite === 'true') {
      where.favorite = true
    }

    const [credentials, total] = await Promise.all([
      prisma.credential.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          userId: true,
          scope: true,
          category: true,
          title: true,
          encryptedData: true,
          iv: true,
          authTag: true,
          tags: true,
          favorite: true,
          createdAt: true,
          updatedAt: true,
          lastUsed: true,
        },
      }),
      prisma.credential.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        credentials,
        total,
        page: pageNum,
        limit: limitNum,
      },
    })
  } catch (error) {
    console.error('获取凭证失败:', error)
    res.status(500).json({ error: '获取凭证失败' })
  }
})

// 创建凭证
router.post(
  '/',
  authenticateToken,
  [
    body('category').isIn(['server', 'website', 'api_key', 'database', 'document', 'other']),
    body('title').notEmpty().isLength({ max: 200 }),
    body('encryptedData').notEmpty(),
    body('iv').notEmpty(),
    body('authTag').notEmpty(),
    body('scope').optional().isIn(['personal', 'shared']),
  ],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.userId!
    const workspaceKeyHash = req.workspaceKeyHash!
    const { category, title, encryptedData, iv, authTag, tags } = req.body
    const scope = req.body.scope === 'shared' ? 'shared' : 'personal'

    try {
      if (scope === 'shared' && !req.sharedAccess) {
        return res.status(403).json({ error: '未开通共享密区权限' })
      }

      const credential = await prisma.credential.create({
        data: {
          userId,
          workspaceKeyHash,
          scope,
          category,
          title,
          encryptedData,
          iv,
          authTag,
          tags: tags || [],
        },
      })

      res.status(201).json({
        success: true,
        data: credential,
      })
    } catch (error) {
      console.error('创建凭证失败:', error)
      res.status(500).json({ error: '创建凭证失败' })
    }
  }
)

// 更新凭证
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params
  const userId = req.userId!
  const { title, encryptedData, iv, authTag, tags, favorite } = req.body
  const scope = req.body.scope === 'shared' ? 'shared' : req.body.scope === 'personal' ? 'personal' : undefined

  try {
    if (scope === 'shared' && !req.sharedAccess) {
      return res.status(403).json({ error: '未开通共享密区权限' })
    }

    // 检查凭证是否存在且属于当前用户
    const existing = await prisma.credential.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return res.status(404).json({ error: '凭证不存在' })
    }

    // 如果有数据更新，保存历史版本
    if (encryptedData) {
      await prisma.credentialHistory.create({
        data: {
          credentialId: id,
          encryptedData: existing.encryptedData,
          iv: existing.iv,
          authTag: existing.authTag,
          version: 1,
        },
      })
    }

    const credential = await prisma.credential.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(encryptedData && { encryptedData }),
        ...(iv && { iv }),
        ...(authTag && { authTag }),
        ...(tags && { tags }),
        ...(favorite !== undefined && { favorite }),
        ...(scope && { scope }),
      },
    })

    res.json({
      success: true,
      data: credential,
    })
  } catch (error) {
    console.error('更新凭证失败:', error)
    res.status(500).json({ error: '更新凭证失败' })
  }
})

// 删除凭证（软删除）
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params
  const userId = req.userId!

  try {
    const credential = await prisma.credential.updateMany({
      where: { id, userId },
      data: { deleted: true },
    })

    if (credential.count === 0) {
      return res.status(404).json({ error: '凭证不存在' })
    }

    res.json({
      success: true,
      message: '凭证已删除',
    })
  } catch (error) {
    console.error('删除凭证失败:', error)
    res.status(500).json({ error: '删除凭证失败' })
  }
})

// 恢复凭证
router.post('/:id/restore', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params
  const userId = req.userId!

  try {
    const credential = await prisma.credential.updateMany({
      where: { id, userId, deleted: true },
      data: { deleted: false },
    })

    if (credential.count === 0) {
      return res.status(404).json({ error: '凭证不存在' })
    }

    res.json({
      success: true,
      message: '凭证已恢复',
    })
  } catch (error) {
    console.error('恢复凭证失败:', error)
    res.status(500).json({ error: '恢复凭证失败' })
  }
})

export default router

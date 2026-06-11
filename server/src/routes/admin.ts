import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import crypto from 'crypto'

const router = Router()
const prisma = new PrismaClient()

// 生成邀请码
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

// 检查是否是管理员
const requireAdmin = (req: AuthRequest, res: any, next: any) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

// 获取系统统计信息（管理员）
router.get('/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!

  try {
    const [totalUsers, activeUsers, totalInviteCodes, activeInviteCodes] = await Promise.all([
      prisma.user.count({ where: { workspaceKeyHash } }),
      prisma.user.count({ where: { workspaceKeyHash, isActive: true } }),
      prisma.inviteCode.count({ where: { workspaceKeyHash } }),
      prisma.inviteCode.count({ where: { workspaceKeyHash, isActive: true } }),
    ])

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalInviteCodes,
        activeInviteCodes,
      },
    })
  } catch (error) {
    console.error('获取统计信息失败:', error)
    res.status(500).json({ error: '获取统计信息失败' })
  }
})

// 创建邀请码（管理员）
router.post(
  '/invite-codes',
  authenticateToken,
  requireAdmin,
  [
    body('maxUses').optional().isInt({ min: 1 }),
    body('expiresInDays').optional().isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.userId!
    const workspaceKeyHash = req.workspaceKeyHash!
    const { maxUses = 1, expiresInDays } = req.body

    try {
      const code = generateInviteCode()
      let expiresAt: Date | null = null

      if (expiresInDays) {
        expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiresInDays)
      }

      const inviteCode = await prisma.inviteCode.create({
        data: {
          code,
          workspaceKeyHash,
          createdBy: userId,
          maxUses,
          expiresAt,
        },
      })

      res.status(201).json({
        success: true,
        data: inviteCode,
      })
    } catch (error) {
      console.error('创建邀请码失败:', error)
      res.status(500).json({ error: '创建邀请码失败' })
    }
  }
)

// 获取邀请码列表（管理员）
router.get('/invite-codes', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!

  try {
    const inviteCodes = await prisma.inviteCode.findMany({
      where: { workspaceKeyHash },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    })

    res.json({
      success: true,
      data: inviteCodes,
    })
  } catch (error) {
    console.error('获取邀请码列表失败:', error)
    res.status(500).json({ error: '获取邀请码列表失败' })
  }
})

// 禁用邀请码（管理员）
router.patch(
  '/invite-codes/:id/disable',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { id } = req.params
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const inviteCode = await prisma.inviteCode.updateMany({
        where: { id, workspaceKeyHash },
        data: { isActive: false },
      })

      if (inviteCode.count === 0) {
        return res.status(404).json({ error: '邀请码不存在' })
      }

      res.json({
        success: true,
        data: { id, isActive: false },
      })
    } catch (error) {
      console.error('禁用邀请码失败:', error)
      res.status(500).json({ error: '禁用邀请码失败' })
    }
  }
)

// 启用邀请码（管理员）
router.patch(
  '/invite-codes/:id/enable',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { id } = req.params
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const inviteCode = await prisma.inviteCode.updateMany({
        where: { id, workspaceKeyHash },
        data: { isActive: true },
      })

      if (inviteCode.count === 0) {
        return res.status(404).json({ error: '邀请码不存在' })
      }

      res.json({
        success: true,
        data: { id, isActive: true },
      })
    } catch (error) {
      console.error('启用邀请码失败:', error)
      res.status(500).json({ error: '启用邀请码失败' })
    }
  }
)

// 删除邀请码（管理员）
router.delete(
  '/invite-codes/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { id } = req.params
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const inviteCode = await prisma.inviteCode.deleteMany({
        where: { id, workspaceKeyHash },
      })

      if (inviteCode.count === 0) {
        return res.status(404).json({ error: '邀请码不存在' })
      }

      res.json({
        success: true,
        message: '邀请码已删除',
      })
    } catch (error) {
      console.error('删除邀请码失败:', error)
      res.status(500).json({ error: '删除邀请码失败' })
    }
  }
)

// 获取用户列表（管理员）
router.get('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  const workspaceKeyHash = req.workspaceKeyHash!

  try {
    const users = await prisma.user.findMany({
      where: { workspaceKeyHash },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        sharedAccess: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        invitedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: users,
    })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

// 启用或禁用用户（管理员）
router.patch(
  '/users/:id/status',
  authenticateToken,
  requireAdmin,
  [body('isActive').isBoolean()],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { id } = req.params
    const { isActive } = req.body as { isActive: boolean }
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const targetUser = await prisma.user.findFirst({
        where: { id, workspaceKeyHash },
        select: {
          id: true,
          isAdmin: true,
          isActive: true,
        },
      })

      if (!targetUser) {
        return res.status(404).json({ error: '用户不存在' })
      }

      if (id === req.userId && !isActive) {
        return res.status(400).json({ error: '不能禁用当前登录的管理员账号' })
      }

      if (!isActive && targetUser.isAdmin && targetUser.isActive) {
        const otherActiveAdmins = await prisma.user.count({
          where: {
            id: { not: id },
            workspaceKeyHash,
            isAdmin: true,
            isActive: true,
          },
        })

        if (otherActiveAdmins === 0) {
          return res.status(400).json({ error: '至少需要保留一个启用的管理员账号' })
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
          sharedAccess: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          invitedBy: true,
        },
      })

      res.json({
        success: true,
        data: user,
      })
    } catch (error) {
      console.error('更新用户状态失败:', error)
      res.status(500).json({ error: '更新用户状态失败' })
    }
  }
)

// 授予或撤销管理员权限
router.patch(
  '/users/:id/admin',
  authenticateToken,
  requireAdmin,
  [body('isAdmin').isBoolean()],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { id } = req.params
    const { isAdmin } = req.body as { isAdmin: boolean }
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const targetUser = await prisma.user.findFirst({
        where: { id, workspaceKeyHash },
        select: {
          id: true,
          isAdmin: true,
          isActive: true,
        },
      })

      if (!targetUser) {
        return res.status(404).json({ error: '用户不存在' })
      }

      if (id === req.userId && !isAdmin) {
        return res.status(400).json({ error: '不能撤销自己的管理员权限' })
      }

      if (!isAdmin && targetUser.isAdmin && targetUser.isActive) {
        const otherActiveAdmins = await prisma.user.count({
          where: {
            id: { not: id },
            workspaceKeyHash,
            isAdmin: true,
            isActive: true,
          },
        })

        if (otherActiveAdmins === 0) {
          return res.status(400).json({ error: '至少需要保留一个启用的管理员账号' })
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isAdmin },
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
          sharedAccess: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          invitedBy: true,
        },
      })

      res.json({
        success: true,
        data: user,
      })
    } catch (error) {
      console.error('更新管理员权限失败:', error)
      res.status(500).json({ error: '更新管理员权限失败' })
    }
  }
)

// 开启或关闭共享密区权限
router.patch(
  '/users/:id/shared-access',
  authenticateToken,
  requireAdmin,
  [body('sharedAccess').isBoolean()],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { id } = req.params
    const { sharedAccess } = req.body as { sharedAccess: boolean }
    const workspaceKeyHash = req.workspaceKeyHash!

    try {
      const targetUser = await prisma.user.findFirst({
        where: { id, workspaceKeyHash },
        select: { id: true },
      })

      if (!targetUser) {
        return res.status(404).json({ error: '用户不存在' })
      }

      const user = await prisma.user.update({
        where: { id },
        data: { sharedAccess },
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
          sharedAccess: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          invitedBy: true,
        },
      })

      res.json({
        success: true,
        data: user,
      })
    } catch (error) {
      console.error('更新共享密区权限失败:', error)
      res.status(500).json({ error: '更新共享密区权限失败' })
    }
  }
)

export default router

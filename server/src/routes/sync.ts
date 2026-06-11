import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// 推送本地更改
router.post(
  '/push',
  authenticateToken,
  [body('deviceId').notEmpty(), body('changes').isArray()],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.userId!
    const { deviceId, changes } = req.body

    try {
      await prisma.syncLog.create({
        data: {
          userId,
          deviceId,
          action: 'push',
          status: 'success',
        },
      })

      res.json({
        success: true,
        message: '同步成功',
      })
    } catch (error) {
      console.error('同步推送失败:', error)

      await prisma.syncLog.create({
        data: {
          userId,
          deviceId,
          action: 'push',
          status: 'failed',
          errorMessage: (error as Error).message,
        },
      })

      res.status(500).json({ error: '同步推送失败' })
    }
  }
)

// 拉取远程更改
router.post(
  '/pull',
  authenticateToken,
  [body('deviceId').notEmpty()],
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = req.userId!
    const { deviceId, lastSync } = req.body

    try {
      const credentials = await prisma.credential.findMany({
        where: {
          userId,
          deleted: false,
          ...(lastSync && { updatedAt: { gt: new Date(lastSync) } }),
        },
        orderBy: { updatedAt: 'desc' },
      })

      await prisma.syncLog.create({
        data: {
          userId,
          deviceId,
          action: 'pull',
          status: 'success',
        },
      })

      res.json({
        success: true,
        data: {
          credentials,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('同步拉取失败:', error)

      await prisma.syncLog.create({
        data: {
          userId,
          deviceId,
          action: 'pull',
          status: 'failed',
          errorMessage: (error as Error).message,
        },
      })

      res.status(500).json({ error: '同步拉取失败' })
    }
  }
)

export default router

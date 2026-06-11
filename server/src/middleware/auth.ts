import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { getWorkspaceKeyHash } from '../utils/workspace'

export interface AuthRequest extends Request {
  userId?: string
  isAdmin?: boolean
  sharedAccess?: boolean
  workspaceKeyHash?: string
}

const prisma = new PrismaClient()

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceKeyHash = getWorkspaceKeyHash(req, res)
  if (!workspaceKeyHash) return

  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      isAdmin?: boolean
      workspaceKeyHash?: string
    }

    if (decoded.workspaceKeyHash !== workspaceKeyHash) {
      return res.status(403).json({ error: '工作区 Key 与登录令牌不匹配' })
    }

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        workspaceKeyHash,
      },
      select: {
        isActive: true,
        isAdmin: true,
        sharedAccess: true,
      },
    })

    if (!user || !user.isActive) {
      return res.status(403).json({ error: '账号已被禁用或不存在' })
    }

    req.userId = decoded.userId
    req.isAdmin = user.isAdmin
    req.sharedAccess = user.sharedAccess
    req.workspaceKeyHash = workspaceKeyHash
    next()
  } catch (error) {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

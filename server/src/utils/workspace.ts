import crypto from 'crypto'
import { Request, Response } from 'express'

export const WORKSPACE_KEY_HEADER = 'x-macmima-workspace-key'

export function hashWorkspaceKey(workspaceKey: string): string {
  return crypto.createHash('sha256').update(workspaceKey.trim()).digest('hex')
}

export function getWorkspaceKeyHash(req: Request, res: Response): string | null {
  const rawHeader = req.headers[WORKSPACE_KEY_HEADER]
  const workspaceKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

  if (!workspaceKey || !workspaceKey.trim()) {
    res.status(400).json({ error: '请先配置工作区 Key' })
    return null
  }

  return hashWorkspaceKey(workspaceKey)
}

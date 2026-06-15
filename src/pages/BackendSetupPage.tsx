import { useState } from 'react'
import { ArrowRight, Check, Copy, KeyRound, RefreshCw, Server } from 'lucide-react'
import { normalizeBackendUrl, saveBackendConfigPersistent } from '@/services/api'
import { copyToClipboard } from '@/utils/clipboard'

interface BackendSetupPageProps {
  onConfigured: () => void
}

export default function BackendSetupPage({ onConfigured }: BackendSetupPageProps) {
  const [backendUrl, setBackendUrl] = useState('')
  const [workspaceKey, setWorkspaceKey] = useState('')
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const generateWorkspaceKey = () => {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

    setWorkspaceKey(key)
    setCopiedKey(false)
  }

  const copyWorkspaceKey = async () => {
    if (!workspaceKey.trim()) return

    const success = await copyToClipboard(workspaceKey.trim(), 0)
    if (success) {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    const normalizedUrl = normalizeBackendUrl(backendUrl)
    const key = workspaceKey.trim()

    try {
      const parsed = new URL(normalizedUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('后端地址必须以 http:// 或 https:// 开头')
        return
      }
    } catch {
      setError('请输入有效的后端地址')
      return
    }

    if (key.length < 6) {
      setError('工作区 Key 至少 6 位')
      return
    }

    try {
      setIsSaving(true)
      await saveBackendConfigPersistent({
        backendUrl: normalizedUrl,
        workspaceKey: key,
      })
      onConfigured()
    } catch (saveError: any) {
      setError(saveError.message || '保存配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg bg-black">
            <img src="./icon.png" alt="MacMima" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-950">连接 MacMima 后端</h1>
          <p className="text-gray-500 mt-2">首次启动需要配置后端地址和工作区 Key</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              后端地址
            </label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="url"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="http://服务器地址/macmima-api"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                工作区 Key
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateWorkspaceKey}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  生成
                </button>
                <button
                  type="button"
                  onClick={copyWorkspaceKey}
                  disabled={!workspaceKey.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={workspaceKey}
                onChange={(event) => {
                  setWorkspaceKey(event.target.value)
                  setCopiedKey(false)
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                placeholder="同一个团队使用同一个 Key"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              同一后端地址和同一 Key 下，第一个注册用户自动成为管理员。
            </p>
          </div>

          {error && (
            <div className="bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-all font-medium flex items-center justify-center gap-2 shadow-lg"
          >
            {isSaving ? '保存中' : '保存并继续'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}

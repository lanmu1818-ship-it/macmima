import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, RefreshCw, Save } from 'lucide-react'
import { clearBackendConfig, getBackendConfig } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { copyToClipboard } from '@/utils/clipboard'
import PageShell from '@/components/layouts/PageShell'

const DEFAULT_LOCAL_API_CONFIG: LocalApiConfig = {
  enabled: false,
  port: 37621,
  apiKey: '',
  requestUrl: 'http://127.0.0.1:37621/v1/credentials',
  isRunning: false,
  lastError: null,
}

export default function SettingsPage() {
  const { logout } = useAuthStore()
  const [backendConfig] = useState(() => getBackendConfig())
  const [showWorkspaceKey, setShowWorkspaceKey] = useState(false)
  const [showLocalApiKey, setShowLocalApiKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isLocalApiAvailable, setIsLocalApiAvailable] = useState(false)
  const [localApiConfig, setLocalApiConfigState] =
    useState<LocalApiConfig>(DEFAULT_LOCAL_API_CONFIG)
  const [localApiDraft, setLocalApiDraft] =
    useState<LocalApiConfig>(DEFAULT_LOCAL_API_CONFIG)
  const [isSavingLocalApi, setIsSavingLocalApi] = useState(false)
  const [localApiMessage, setLocalApiMessage] = useState('')

  const localApiRequestUrl = `http://127.0.0.1:${
    Number(localApiDraft.port) || DEFAULT_LOCAL_API_CONFIG.port
  }/v1/credentials`
  const localApiExampleBody = `{
  "title": "数据库账号示例",
  "category": "database",
  "scope": "personal",
  "databaseType": "mysql",
  "host": "127.0.0.1",
  "port": "3306",
  "database": "test_db",
  "username": "test_user",
  "password": "test_password",
  "tables": [
    { "name": "users", "description": "用户表" },
    { "name": "orders", "description": "订单表" }
  ],
  "tags": ["自动导入"]
}`
  const localApiCurlDisplay = `curl -X POST "${localApiRequestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-MacMima-Local-Api-Key: 你的API_KEY" \\
  --data '${localApiExampleBody}'`
  const localApiCurlCopy = `curl -X POST "${localApiRequestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-MacMima-Local-Api-Key: ${localApiDraft.apiKey || '你的API_KEY'}" \\
  --data '${localApiExampleBody}'`

  useEffect(() => {
    let isMounted = true

    const loadLocalApiConfig = async () => {
      if (!window.electronAPI?.getLocalApiConfig) return

      setIsLocalApiAvailable(true)

      try {
        const config = await window.electronAPI.getLocalApiConfig()
        if (!isMounted) return

        setLocalApiConfigState(config)
        setLocalApiDraft(config)
      } catch (error: any) {
        if (isMounted) {
          setLocalApiMessage(error.message || '读取本地 API 配置失败')
        }
      }
    }

    loadLocalApiConfig()

    return () => {
      isMounted = false
    }
  }, [])

  const updateLocalApiDraft = (updates: Partial<LocalApiConfig>) => {
    setLocalApiDraft((current) => ({ ...current, ...updates }))
    setLocalApiMessage('')
  }

  const handleCopy = async (field: string, value?: string) => {
    if (!value) return

    const success = await copyToClipboard(value, 0)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleResetBackend = () => {
    if (!confirm('确定要重新配置后端地址和工作区 Key 吗？')) return

    logout()
    clearBackendConfig()
    window.location.hash = '/'
    window.location.reload()
  }

  const handleGenerateLocalApiKey = async () => {
    if (!window.electronAPI?.generateLocalApiKey) return

    const apiKey = await window.electronAPI.generateLocalApiKey()
    updateLocalApiDraft({ apiKey })
    setShowLocalApiKey(true)
  }

  const handleSaveLocalApi = async () => {
    if (!window.electronAPI?.setLocalApiConfig) return

    try {
      setIsSavingLocalApi(true)
      setLocalApiMessage('')

      const config = await window.electronAPI.setLocalApiConfig({
        enabled: localApiDraft.enabled,
        port: Number(localApiDraft.port) || DEFAULT_LOCAL_API_CONFIG.port,
        apiKey: localApiDraft.apiKey.trim(),
      })

      setLocalApiConfigState(config)
      setLocalApiDraft(config)
      setLocalApiMessage('已保存')
    } catch (error: any) {
      setLocalApiMessage(error.message || '保存本地 API 配置失败')
    } finally {
      setIsSavingLocalApi(false)
    }
  }

  return (
    <PageShell title="个人设置" contentClassName="space-y-6">
          {/* 安全设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">安全设置</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">自动锁定</p>
                  <p className="text-sm text-gray-500">无操作后自动锁定应用</p>
                </div>
                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="300">5分钟</option>
                  <option value="600">10分钟</option>
                  <option value="1800">30分钟</option>
                  <option value="never">从不</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">剪贴板自动清除</p>
                  <p className="text-sm text-gray-500">复制后自动清除剪贴板</p>
                </div>
                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="30">30秒</option>
                  <option value="60">1分钟</option>
                  <option value="never">从不</option>
                </select>
              </div>
            </div>
          </div>

          {/* 账户设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">账户设置</h2>
            <div className="space-y-4">
              <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                修改主密码
              </button>
              <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                导出数据
              </button>
              <button className="w-full text-left px-4 py-3 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-lg transition-colors">
                删除账户
              </button>
            </div>
          </div>

          {/* 后端设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">后端设置</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">当前后端地址</p>
                  <button
                    onClick={() => handleCopy('backendUrl', backendConfig?.backendUrl)}
                    disabled={!backendConfig?.backendUrl}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copiedField === 'backendUrl' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedField === 'backendUrl' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700 break-all">
                  {backendConfig?.backendUrl || '未配置'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">当前工作区 Key</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowWorkspaceKey((value) => !value)}
                      disabled={!backendConfig?.workspaceKey}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {showWorkspaceKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {showWorkspaceKey ? '隐藏' : '查看'}
                    </button>
                    <button
                      onClick={() => handleCopy('workspaceKey', backendConfig?.workspaceKey)}
                      disabled={!backendConfig?.workspaceKey}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {copiedField === 'workspaceKey' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedField === 'workspaceKey' ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
                <input
                  readOnly
                  type={showWorkspaceKey ? 'text' : 'password'}
                  value={backendConfig?.workspaceKey || ''}
                  placeholder="未配置"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700"
                />
              </div>

              <button
                onClick={handleResetBackend}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                重新配置后端地址和工作区 Key
              </button>
            </div>
          </div>

          {/* 本地 API */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">本地 API</h2>
                {isLocalApiAvailable && (
                  <p className="text-sm text-gray-500 mt-1">
                    {localApiConfig.enabled
                      ? localApiConfig.isRunning
                        ? '运行中'
                        : '未运行'
                      : '已关闭'}
                  </p>
                )}
              </div>

              {isLocalApiAvailable && (
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  启用
                  <input
                    type="checkbox"
                    checked={localApiDraft.enabled}
                    onChange={(e) => updateLocalApiDraft({ enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </label>
              )}
            </div>

            {!isLocalApiAvailable ? (
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                桌面端可用
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">端口</label>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={localApiDraft.port}
                    onChange={(e) => updateLocalApiDraft({ port: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">请求地址</p>
                    <button
                      onClick={() => handleCopy('localApiUrl', localApiRequestUrl)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
                    >
                      {copiedField === 'localApiUrl' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedField === 'localApiUrl' ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700 break-all">
                    {localApiRequestUrl}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">API Key</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowLocalApiKey((value) => !value)}
                        disabled={!localApiDraft.apiKey}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {showLocalApiKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        {showLocalApiKey ? '隐藏' : '查看'}
                      </button>
                      <button
                        onClick={handleGenerateLocalApiKey}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        生成
                      </button>
                      <button
                        onClick={() => handleCopy('localApiKey', localApiDraft.apiKey)}
                        disabled={!localApiDraft.apiKey}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {copiedField === 'localApiKey' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedField === 'localApiKey' ? '已复制' : '复制'}
                      </button>
                    </div>
                  </div>
                  <input
                    readOnly
                    type={showLocalApiKey ? 'text' : 'password'}
                    value={localApiDraft.apiKey}
                    placeholder="未生成"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">调用文档</p>
                      <p className="text-xs text-gray-500 mt-1">
                        其他软件用 POST 向本机推送凭证，MacMima 需要保持打开并已解锁。
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy('localApiCurl', localApiCurlCopy)}
                      className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-100"
                    >
                      {copiedField === 'localApiCurl' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedField === 'localApiCurl' ? '已复制' : '复制示例'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                      <p className="text-gray-500">Method</p>
                      <p className="font-mono text-gray-900 mt-1">POST</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 md:col-span-2">
                      <p className="text-gray-500">Header</p>
                      <p className="font-mono text-gray-900 mt-1 break-all">
                        X-MacMima-Local-Api-Key: 你的API_KEY
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs">
                    <p className="text-gray-500">数据库表说明</p>
                    <p className="font-mono text-gray-900 mt-1 break-all">
                      tables: [{'{ "name": "表名", "description": "说明" }'}]
                    </p>
                  </div>

                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-white p-3 font-mono text-[11px] leading-5 text-gray-700">
                    {localApiCurlDisplay}
                  </pre>
                </div>

                {localApiConfig.lastError && (
                  <div className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                    {localApiConfig.lastError}
                  </div>
                )}
                {localApiMessage && (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                    {localApiMessage}
                  </div>
                )}

                <button
                  onClick={handleSaveLocalApi}
                  disabled={isSavingLocalApi}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingLocalApi ? '保存中' : '保存本地 API'}
                </button>
              </div>
            )}
          </div>

          {/* 关于 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">关于</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>版本: 0.1.0</p>
              <p>© 2026 MacMima Team</p>
            </div>
          </div>
    </PageShell>
  )
}

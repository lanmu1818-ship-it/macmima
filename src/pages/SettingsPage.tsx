import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { api, clearBackendConfig, getBackendConfig } from '@/services/api'
import {
  defaultCryptoProfile,
  generateCryptoSecret,
  loadCryptoProfile,
  saveCryptoProfile,
  StoredCryptoProfile,
} from '@/services/cryptoProfile'
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

const maxAvatarBytes = 256 * 1024

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取头像失败'))
    reader.readAsDataURL(file)
  })
}

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

export default function SettingsPage() {
  const { logout, user, updateUser } = useAuthStore()
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
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [displayNameDraft, setDisplayNameDraft] = useState(user?.displayName || user?.username || '')
  const [avatarDraft, setAvatarDraft] = useState(user?.avatarDataUrl || '')
  const [profileMessage, setProfileMessage] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [cryptoProfile, setCryptoProfileState] =
    useState<StoredCryptoProfile>(defaultCryptoProfile)
  const [cryptoProfileDraft, setCryptoProfileDraft] =
    useState<StoredCryptoProfile>(defaultCryptoProfile)
  const [showLocalSecret, setShowLocalSecret] = useState(false)
  const [showSharedVaultSecret, setShowSharedVaultSecret] = useState(false)
  const [cryptoProfileMessage, setCryptoProfileMessage] = useState('')
  const [isSavingCryptoProfile, setIsSavingCryptoProfile] = useState(false)

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
  const localApiDocumentBody = `{
  "title": "OpenAI Responses API 文档",
  "category": "document",
  "scope": "shared",
  "description": "团队共用的请求参数和示例",
  "content": "# Responses API\\n\\n## Endpoint\\nPOST /v1/responses\\n\\n保存请求说明、字段含义和注意事项。",
  "tags": ["API文档", "团队共享"]
}`
  const localApiCurlDisplay = `curl -X POST "${localApiRequestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-MacMima-Local-Api-Key: 你的API_KEY" \\
  --data '${localApiExampleBody}'`
  const localApiCurlCopy = `curl -X POST "${localApiRequestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-MacMima-Local-Api-Key: ${localApiDraft.apiKey || '你的API_KEY'}" \\
  --data '${localApiExampleBody}'`
  const localApiDocumentCurlCopy = `curl -X POST "${localApiRequestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-MacMima-Local-Api-Key: ${localApiDraft.apiKey || '你的API_KEY'}" \\
  --data '${localApiDocumentBody}'`

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

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setAppVersion).catch(() => undefined)
  }, [])

  useEffect(() => {
    let isMounted = true

    loadCryptoProfile()
      .then((profile) => {
        if (!isMounted) return
        setCryptoProfileState(profile)
        setCryptoProfileDraft(profile)
      })
      .catch((error: any) => {
        if (isMounted) setCryptoProfileMessage(error.message || '读取加密配置失败')
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setDisplayNameDraft(user?.displayName || user?.username || '')
    setAvatarDraft(user?.avatarDataUrl || '')
  }, [user?.avatarDataUrl, user?.displayName, user?.username])

  const updateLocalApiDraft = (updates: Partial<LocalApiConfig>) => {
    setLocalApiDraft((current) => ({ ...current, ...updates }))
    setLocalApiMessage('')
  }

  const updateCryptoProfileDraft = (updates: Partial<StoredCryptoProfile>) => {
    setCryptoProfileDraft((current) => ({ ...current, ...updates }))
    setCryptoProfileMessage('')
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

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setProfileMessage('头像仅支持 PNG、JPG 或 WebP')
      return
    }

    if (file.size > maxAvatarBytes) {
      setProfileMessage('头像不能超过 256KB')
      return
    }

    try {
      setAvatarDraft(await readFileAsDataUrl(file))
      setProfileMessage('')
    } catch (error: any) {
      setProfileMessage(error.message || '读取头像失败')
    }
  }

  const handleSaveProfile = async () => {
    const displayName = displayNameDraft.trim()
    if (displayName.length > 60) {
      setProfileMessage('昵称不能超过 60 个字符')
      return
    }

    try {
      setIsSavingProfile(true)
      setProfileMessage('')

      const response = await api.patch('/auth/profile', {
        displayName,
        avatarDataUrl: avatarDraft || null,
      })
      const payload = unwrapResponseData<{ user: typeof user }>(response)

      if (payload.user) {
        updateUser(payload.user)
        setDisplayNameDraft(payload.user.displayName || payload.user.username)
        setAvatarDraft(payload.user.avatarDataUrl || '')
      }

      setProfileMessage('已保存')
    } catch (error: any) {
      setProfileMessage(error.response?.data?.error || error.message || '保存个人资料失败')
    } finally {
      setIsSavingProfile(false)
    }
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

  const handleGenerateCryptoSecret = async (field: 'localSecret' | 'sharedVaultSecret') => {
    const secret = window.electronAPI?.generateCryptoSecret
      ? await window.electronAPI.generateCryptoSecret()
      : generateCryptoSecret()

    updateCryptoProfileDraft({ [field]: secret })
    if (field === 'localSecret') setShowLocalSecret(true)
    if (field === 'sharedVaultSecret') setShowSharedVaultSecret(true)
  }

  const handleSaveCryptoProfile = async () => {
    try {
      setIsSavingCryptoProfile(true)
      setCryptoProfileMessage('')

      const savedProfile = await saveCryptoProfile({
        ...cryptoProfileDraft,
        kdfIterations: Number(cryptoProfileDraft.kdfIterations) || 210000,
      })

      setCryptoProfileState(savedProfile)
      setCryptoProfileDraft(savedProfile)
      setCryptoProfileMessage('已保存。新创建或编辑的凭证会按当前配置加密。')
    } catch (error: any) {
      setCryptoProfileMessage(error.message || '保存加密配置失败')
    } finally {
      setIsSavingCryptoProfile(false)
    }
  }

  return (
    <PageShell title="个人设置" contentClassName="space-y-6">
          {/* 个人资料 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">个人资料</h2>
            <div className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-white shadow-md">
                  {avatarDraft ? (
                    <img
                      src={avatarDraft}
                      alt={displayNameDraft || user?.username || '头像'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-7 w-7" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                    <Upload className="h-3.5 w-3.5" />
                    上传
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarFile}
                    />
                  </label>
                  {avatarDraft && (
                    <button
                      type="button"
                      onClick={() => setAvatarDraft('')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      清除
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">昵称</label>
                  <input
                    type="text"
                    value={displayNameDraft}
                    onChange={(event) => {
                      setDisplayNameDraft(event.target.value)
                      setProfileMessage('')
                    }}
                    maxLength={60}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-300 focus:bg-white"
                    placeholder={user?.username || '设置聊天昵称'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    昵称和头像会显示在开发讨论中；登录用户名不会被修改。
                  </p>
                </div>
                {profileMessage && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {profileMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingProfile ? '保存中' : '保存个人资料'}
                </button>
              </div>
            </div>
          </div>

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

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950 text-white">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">MacMima Crypto v2</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        AES-256-GCM + PBKDF2-SHA256。算法公开，密钥私有；本地增强密钥和共享密区加密密钥不会上传后端。
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700">
                    启用
                    <input
                      type="checkbox"
                      checked={cryptoProfileDraft.enabled}
                      onChange={(event) =>
                        updateCryptoProfileDraft({ enabled: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      KDF 迭代次数
                    </label>
                    <input
                      type="number"
                      min={100000}
                      max={1000000}
                      step={10000}
                      value={cryptoProfileDraft.kdfIterations}
                      onChange={(event) =>
                        updateCryptoProfileDraft({
                          kdfIterations: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-700 outline-none focus:border-gray-300"
                    />
                    <p className="mt-1 text-xs text-gray-500">建议 210000 起。越高越安全，也会更慢。</p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                    <p className="font-medium text-gray-900">当前状态</p>
                    <p className="mt-1">
                      个人密区：{cryptoProfile.localSecret ? 'v2增强已准备' : '首次保存时自动生成'}
                    </p>
                    <p className="mt-1">
                      共享密区：{cryptoProfile.sharedVaultSecret ? 'v2共享密钥已配置' : '未配置时使用兼容模式'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">本地增强密钥</p>
                        <p className="mt-1 text-xs text-gray-500">
                          只保护个人密区 v2 数据。换电脑前需要备份；丢失后无法解密用它保存的数据。
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLocalSecret((value) => !value)}
                          disabled={!cryptoProfileDraft.localSecret}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {showLocalSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showLocalSecret ? '隐藏' : '查看'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateCryptoSecret('localSecret')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          生成
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy('localCryptoSecret', cryptoProfileDraft.localSecret)}
                          disabled={!cryptoProfileDraft.localSecret}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {copiedField === 'localCryptoSecret' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedField === 'localCryptoSecret' ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>
                    <input
                      type={showLocalSecret ? 'text' : 'password'}
                      value={cryptoProfileDraft.localSecret}
                      onChange={(event) =>
                        updateCryptoProfileDraft({ localSecret: event.target.value })
                      }
                      placeholder="留空时首次保存个人凭证会自动生成"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-700 outline-none focus:border-gray-300"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">共享密区加密密钥</p>
                        <p className="mt-1 text-xs text-gray-500">
                          团队成员需配置同一个值才能解密共享密区 v2 数据；它不会作为请求头发送到后端。
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSharedVaultSecret((value) => !value)}
                          disabled={!cryptoProfileDraft.sharedVaultSecret}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {showSharedVaultSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showSharedVaultSecret ? '隐藏' : '查看'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateCryptoSecret('sharedVaultSecret')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          生成
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy('sharedVaultSecret', cryptoProfileDraft.sharedVaultSecret)
                          }
                          disabled={!cryptoProfileDraft.sharedVaultSecret}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {copiedField === 'sharedVaultSecret' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedField === 'sharedVaultSecret' ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>
                    <input
                      type={showSharedVaultSecret ? 'text' : 'password'}
                      value={cryptoProfileDraft.sharedVaultSecret}
                      onChange={(event) =>
                        updateCryptoProfileDraft({ sharedVaultSecret: event.target.value })
                      }
                      placeholder="未配置时共享密区继续使用兼容模式"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-700 outline-none focus:border-gray-300"
                    />
                  </div>
                </div>

                {cryptoProfileMessage && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                    {cryptoProfileMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveCryptoProfile}
                  disabled={isSavingCryptoProfile}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingCryptoProfile ? '保存中' : '保存加密配置'}
                </button>
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
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleCopy('localApiCurl', localApiCurlCopy)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {copiedField === 'localApiCurl' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedField === 'localApiCurl' ? '已复制' : '复制凭证示例'}
                      </button>
                      <button
                        onClick={() => handleCopy('localApiDocumentCurl', localApiDocumentCurlCopy)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {copiedField === 'localApiDocumentCurl' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedField === 'localApiDocumentCurl' ? '已复制' : '复制文档示例'}
                      </button>
                    </div>
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

                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs">
                    <p className="text-gray-500">Markdown 文档</p>
                    <p className="font-mono text-gray-900 mt-1 break-all">
                      category: "document"，content 字段保存 Markdown 正文，scope 可设为 shared。
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
              <p>版本: {appVersion}</p>
              <p>© 2026 MacMima Team</p>
            </div>
          </div>
    </PageShell>
  )
}

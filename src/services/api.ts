import axios, { AxiosInstance } from 'axios'

const BACKEND_URL_KEY = 'macmima-backend-url'
const WORKSPACE_KEY_KEY = 'macmima-workspace-key'

export interface BackendConfig {
  backendUrl: string
  workspaceKey: string
}

export function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

export function getBackendConfig(): BackendConfig | null {
  const backendUrl = localStorage.getItem(BACKEND_URL_KEY) || ''
  const workspaceKey = localStorage.getItem(WORKSPACE_KEY_KEY) || ''

  if (!backendUrl || !workspaceKey) return null

  return { backendUrl, workspaceKey }
}

function saveBackendConfigToLocal(config: BackendConfig) {
  localStorage.setItem(BACKEND_URL_KEY, normalizeBackendUrl(config.backendUrl))
  localStorage.setItem(WORKSPACE_KEY_KEY, config.workspaceKey.trim())
  applyBackendConfig()
}

export function hasBackendConfig(): boolean {
  return Boolean(getBackendConfig())
}

export function saveBackendConfig(config: BackendConfig) {
  const normalizedConfig = {
    backendUrl: normalizeBackendUrl(config.backendUrl),
    workspaceKey: config.workspaceKey.trim(),
  }

  saveBackendConfigToLocal(normalizedConfig)
  window.electronAPI?.setBackendConfig?.(normalizedConfig).catch((error) => {
    console.warn('保存稳定后端配置失败:', error)
  })
}

export async function saveBackendConfigPersistent(config: BackendConfig) {
  const normalizedConfig = {
    backendUrl: normalizeBackendUrl(config.backendUrl),
    workspaceKey: config.workspaceKey.trim(),
  }

  saveBackendConfigToLocal(normalizedConfig)
  await window.electronAPI?.setBackendConfig?.(normalizedConfig)
}

export function clearBackendConfig() {
  localStorage.removeItem(BACKEND_URL_KEY)
  localStorage.removeItem(WORKSPACE_KEY_KEY)
  window.electronAPI?.clearBackendConfig?.().catch((error) => {
    console.warn('清除稳定后端配置失败:', error)
  })
  applyBackendConfig()
}

export async function loadBackendConfig() {
  const localConfig = getBackendConfig()

  if (localConfig) {
    await window.electronAPI?.setBackendConfig?.(localConfig).catch((error) => {
      console.warn('迁移后端配置失败:', error)
    })
    return localConfig
  }

  const persistedConfig = await window.electronAPI?.getBackendConfig?.()
  if (persistedConfig?.backendUrl && persistedConfig.workspaceKey) {
    const normalizedConfig = {
      backendUrl: normalizeBackendUrl(persistedConfig.backendUrl),
      workspaceKey: persistedConfig.workspaceKey.trim(),
    }

    saveBackendConfigToLocal(normalizedConfig)
    return normalizedConfig
  }

  return null
}

function getApiBaseUrl() {
  return localStorage.getItem(BACKEND_URL_KEY) || import.meta.env.VITE_API_URL || ''
}

// 创建axios实例供直接使用
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function applyBackendConfig() {
  api.defaults.baseURL = getApiBaseUrl()
}

function isAuthExpiredError(error: any) {
  const status = error.response?.status
  const message = error.response?.data?.error || ''

  return (
    status === 401 ||
    (status === 403 &&
      (message.includes('认证令牌') ||
        message.includes('登录已过期') ||
        message.includes('工作区 Key 与登录令牌不匹配')))
  )
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('auth-token')
  delete api.defaults.headers.common['Authorization']
  window.location.hash = '/login'
}

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const workspaceKey = localStorage.getItem(WORKSPACE_KEY_KEY)
    if (workspaceKey) {
      config.headers['X-MacMima-Workspace-Key'] = workspaceKey
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (isAuthExpiredError(error)) {
      clearAuthAndRedirect()
    }
    return Promise.reject(error)
  }
)

// API服务类（兼容旧代码）
class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: getApiBaseUrl(),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth-token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      const workspaceKey = localStorage.getItem(WORKSPACE_KEY_KEY)
      if (workspaceKey) {
        config.headers['X-MacMima-Workspace-Key'] = workspaceKey
      }

      config.baseURL = getApiBaseUrl()
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (isAuthExpiredError(error)) {
          clearAuthAndRedirect()
        }
        return Promise.reject(error)
      }
    )
  }

  // 认证接口
  async register(data: {
    username: string
    email: string
    passwordHash: string
    salt: string
  }) {
    return this.client.post('/auth/register', data)
  }

  async login(data: { username: string; passwordHash: string }) {
    return this.client.post('/auth/login', data)
  }

  async logout() {
    return this.client.post('/auth/logout')
  }

  // 凭证接口
  async getCredentials(params?: {
    category?: string
    scope?: 'personal' | 'shared'
    tags?: string[]
    favorite?: boolean
    page?: number
    limit?: number
  }) {
    return this.client.get('/credentials', { params })
  }

  async getCredential(id: string) {
    return this.client.get(`/credentials/${id}`)
  }

  async createCredential(data: {
    category: string
    scope?: 'personal' | 'shared'
    title: string
    encryptedData: string
    iv: string
    authTag: string
    tags?: string[]
  }) {
    return this.client.post('/credentials', data)
  }

  async updateCredential(
    id: string,
    data: {
      title?: string
      scope?: 'personal' | 'shared'
      encryptedData?: string
      iv?: string
      authTag?: string
      tags?: string[]
      favorite?: boolean
    }
  ) {
    return this.client.put(`/credentials/${id}`, data)
  }

  async deleteCredential(id: string) {
    return this.client.delete(`/credentials/${id}`)
  }

  async restoreCredential(id: string) {
    return this.client.post(`/credentials/${id}/restore`)
  }

  // 同步接口
  async syncPush(data: { deviceId: string; changes: any[] }) {
    return this.client.post('/sync/push', data)
  }

  async syncPull(params: { deviceId: string; lastSync?: string }) {
    return this.client.post('/sync/pull', params)
  }
}

export const apiService = new ApiService()
export default api

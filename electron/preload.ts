import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 应用控制
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  isWindowFocused: () => ipcRenderer.invoke('app:is-window-focused'),
  showNotification: (payload: AppNotificationPayload) =>
    ipcRenderer.invoke('app:show-notification', payload),
  getLatestRelease: () => ipcRenderer.invoke('app:getLatestRelease'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  getBackendConfig: () => ipcRenderer.invoke('backend-config:get'),
  setBackendConfig: (config: BackendConfig) => ipcRenderer.invoke('backend-config:set', config),
  clearBackendConfig: () => ipcRenderer.invoke('backend-config:clear'),
  getCryptoProfile: () => ipcRenderer.invoke('crypto-profile:get'),
  setCryptoProfile: (config: CryptoProfileConfig) => ipcRenderer.invoke('crypto-profile:set', config),
  generateCryptoSecret: () => ipcRenderer.invoke('crypto-profile:generate-secret'),
  minimize: () => ipcRenderer.send('app:minimize'),
  maximize: () => ipcRenderer.send('app:maximize'),
  close: () => ipcRenderer.send('app:close'),

  // 本地 API
  getLocalApiConfig: () => ipcRenderer.invoke('local-api:get-config'),
  setLocalApiConfig: (config: Partial<LocalApiConfig>) =>
    ipcRenderer.invoke('local-api:set-config', config),
  generateLocalApiKey: () => ipcRenderer.invoke('local-api:generate-key'),
  onLocalApiCredential: (callback: (request: LocalApiCredentialRequest) => void) => {
    const listener = (_event: IpcRendererEvent, request: LocalApiCredentialRequest) => {
      callback(request)
    }

    ipcRenderer.on('local-api:credential-request', listener)
    return () => ipcRenderer.removeListener('local-api:credential-request', listener)
  },
  sendLocalApiCredentialResult: (result: LocalApiCredentialResult) =>
    ipcRenderer.send('local-api:credential-result', result),

  // 监听事件
  onLock: (callback: () => void) => {
    ipcRenderer.on('app:lock', callback)
  },
  onNavigate: (callback: (route: string) => void) => {
    const listener = (_event: IpcRendererEvent, route: string) => {
      callback(route)
    }

    ipcRenderer.on('app:navigate', listener)
    return () => ipcRenderer.removeListener('app:navigate', listener)
  },

  // 清理监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
})

// 类型定义
export interface LocalApiConfig {
  enabled: boolean
  port: number
  apiKey: string
  requestUrl: string
  isRunning: boolean
  lastError: string | null
}

export interface BackendConfig {
  backendUrl: string
  workspaceKey: string
}

export interface CryptoProfileConfig {
  enabled: boolean
  kdfIterations: number
  localSecret: string
  sharedVaultSecret: string
  updatedAt?: string
}

export interface LocalApiCredentialRequest {
  requestId: string
  payload: {
    category: 'server' | 'website' | 'api_key' | 'database' | 'document' | 'other'
    scope: 'personal' | 'shared'
    title: string
    tags: string[]
    data: Record<string, any>
  }
}

export interface LocalApiCredentialResult {
  requestId: string
  ok: boolean
  status?: number
  error?: string
  credential?: {
    id: string
    title: string
    category: string
  }
}

export interface AppNotificationPayload {
  title: string
  body?: string
  route?: string
}

export interface ElectronAPI {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  isWindowFocused: () => Promise<boolean>
  showNotification: (payload: AppNotificationPayload) => Promise<boolean>
  getLatestRelease: () => Promise<ReleaseManifest>
  openExternal: (url: string) => Promise<void>
  getBackendConfig: () => Promise<BackendConfig | null>
  setBackendConfig: (config: BackendConfig) => Promise<BackendConfig>
  clearBackendConfig: () => Promise<boolean>
  getCryptoProfile: () => Promise<CryptoProfileConfig>
  setCryptoProfile: (config: CryptoProfileConfig) => Promise<CryptoProfileConfig>
  generateCryptoSecret: () => Promise<string>
  minimize: () => void
  maximize: () => void
  close: () => void
  getLocalApiConfig: () => Promise<LocalApiConfig>
  setLocalApiConfig: (config: Partial<LocalApiConfig>) => Promise<LocalApiConfig>
  generateLocalApiKey: () => Promise<string>
  onLocalApiCredential: (callback: (request: LocalApiCredentialRequest) => void) => () => void
  sendLocalApiCredentialResult: (result: LocalApiCredentialResult) => void
  onLock: (callback: () => void) => void
  onNavigate: (callback: (route: string) => void) => () => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export interface ReleaseManifest {
  updatedAt: string
  releases: Array<{
    id: string
    platform: 'macos' | 'windows'
    arch: string
    version: string
    filename: string
    size: number
    sha256: string
    downloadUrl: string
    notes?: string
    active: boolean
    createdAt: string
    updatedAt: string
  }>
}

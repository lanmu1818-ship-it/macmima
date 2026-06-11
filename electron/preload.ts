import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 应用控制
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
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

export interface LocalApiCredentialRequest {
  requestId: string
  payload: {
    category: 'server' | 'website' | 'api_key' | 'database' | 'other'
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

export interface ElectronAPI {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  minimize: () => void
  maximize: () => void
  close: () => void
  getLocalApiConfig: () => Promise<LocalApiConfig>
  setLocalApiConfig: (config: Partial<LocalApiConfig>) => Promise<LocalApiConfig>
  generateLocalApiKey: () => Promise<string>
  onLocalApiCredential: (callback: (request: LocalApiCredentialRequest) => void) => () => void
  sendLocalApiCredentialResult: (result: LocalApiCredentialResult) => void
  onLock: (callback: () => void) => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

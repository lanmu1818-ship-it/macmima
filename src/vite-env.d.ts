/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface LocalApiConfig {
  enabled: boolean
  port: number
  apiKey: string
  requestUrl: string
  isRunning: boolean
  lastError: string | null
}

interface LocalApiCredentialRequest {
  requestId: string
  payload: {
    category: 'server' | 'website' | 'api_key' | 'database' | 'other'
    scope: 'personal' | 'shared'
    title: string
    tags: string[]
    data: Record<string, any>
  }
}

interface LocalApiCredentialResult {
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

interface Window {
  electronAPI?: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<string>
    minimize: () => void
    maximize: () => void
    close: () => void
    onLockScreen: (callback: () => void) => void
    onQuickLaunch: (callback: () => void) => void
    onLock: (callback: () => void) => void
    getLocalApiConfig: () => Promise<LocalApiConfig>
    setLocalApiConfig: (config: Partial<LocalApiConfig>) => Promise<LocalApiConfig>
    generateLocalApiKey: () => Promise<string>
    onLocalApiCredential: (callback: (request: LocalApiCredentialRequest) => void) => () => void
    sendLocalApiCredentialResult: (result: LocalApiCredentialResult) => void
    removeAllListeners: (channel: string) => void
  }
}

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
    category: 'server' | 'website' | 'api_key' | 'database' | 'document' | 'other'
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

interface CryptoProfileConfig {
  enabled: boolean
  kdfIterations: number
  localSecret: string
  sharedVaultSecret: string
  updatedAt?: string
}

interface ReleaseManifest {
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

interface Window {
  electronAPI?: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<string>
    isWindowFocused: () => Promise<boolean>
    showNotification: (payload: {
      title: string
      body?: string
      route?: string
    }) => Promise<boolean>
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
    onLockScreen: (callback: () => void) => void
    onQuickLaunch: (callback: () => void) => void
    onLock: (callback: () => void) => void
    getLocalApiConfig: () => Promise<LocalApiConfig>
    setLocalApiConfig: (config: Partial<LocalApiConfig>) => Promise<LocalApiConfig>
    generateLocalApiKey: () => Promise<string>
    onLocalApiCredential: (callback: (request: LocalApiCredentialRequest) => void) => () => void
    sendLocalApiCredentialResult: (result: LocalApiCredentialResult) => void
    onNavigate: (callback: (route: string) => void) => () => void
    removeAllListeners: (channel: string) => void
  }
}

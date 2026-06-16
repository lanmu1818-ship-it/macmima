import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  safeStorage,
  shell,
  Menu,
  nativeImage,
  Notification as ElectronNotification,
  Tray,
} from 'electron'
import { createServer } from 'http'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'
const DEFAULT_LOCAL_API_PORT = 37621
const LOCAL_API_CONFIG_FILE = 'local-api.json'
const APP_CONFIG_FILE = 'app-config.json'
const CRYPTO_PROFILE_FILE = 'crypto-profile.json'
const RELEASES_URL = 'https://macmima.flnxi.com/website-api/releases'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.macmima.app')
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let localApiServer: Server | null = null
let localApiLastError: string | null = null
let isQuitting = false

interface LocalApiConfig {
  enabled: boolean
  port: number
  apiKey: string
}

interface LocalApiStatus extends LocalApiConfig {
  requestUrl: string
  isRunning: boolean
  lastError: string | null
}

interface PendingLocalApiRequest {
  response: ServerResponse
  timeout: NodeJS.Timeout
}

interface BackendConfig {
  backendUrl: string
  workspaceKey: string
}

interface CryptoProfileConfig {
  enabled: boolean
  kdfIterations: number
  localSecret: string
  sharedVaultSecret: string
  updatedAt?: string
}

interface AppNotificationPayload {
  title: string
  body?: string
  route?: string
}

const pendingLocalApiRequests = new Map<string, PendingLocalApiRequest>()
let localApiConfig: LocalApiConfig = {
  enabled: false,
  port: DEFAULT_LOCAL_API_PORT,
  apiKey: '',
}

function getLocalApiConfigPath() {
  return path.join(app.getPath('userData'), LOCAL_API_CONFIG_FILE)
}

function getAppConfigPath() {
  return path.join(app.getPath('userData'), APP_CONFIG_FILE)
}

function getCryptoProfilePath() {
  return path.join(app.getPath('userData'), CRYPTO_PROFILE_FILE)
}

function protectLocalSecret(value: unknown) {
  const secret = typeof value === 'string' ? value.trim() : ''
  if (!secret) return ''

  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(secret).toString('base64')}`
  }

  return `plain:${Buffer.from(secret, 'utf8').toString('base64')}`
}

function unprotectLocalSecret(value: unknown) {
  const secret = typeof value === 'string' ? value.trim() : ''
  if (!secret) return ''

  try {
    if (secret.startsWith('safe:')) {
      return safeStorage.decryptString(Buffer.from(secret.slice(5), 'base64'))
    }

    if (secret.startsWith('plain:')) {
      return Buffer.from(secret.slice(6), 'base64').toString('utf8')
    }
  } catch (error) {
    console.error('解密本地加密配置失败:', error)
    return ''
  }

  return secret
}

function normalizeCryptoProfile(config?: Partial<CryptoProfileConfig> | null): CryptoProfileConfig {
  const iterations = Number(config?.kdfIterations)

  return {
    enabled: !config || config.enabled !== false,
    kdfIterations:
      Number.isFinite(iterations) && iterations >= 100000 && iterations <= 1000000
        ? Math.round(iterations)
        : 210000,
    localSecret: typeof config?.localSecret === 'string' ? config.localSecret.trim() : '',
    sharedVaultSecret:
      typeof config?.sharedVaultSecret === 'string' ? config.sharedVaultSecret.trim() : '',
    updatedAt: typeof config?.updatedAt === 'string' ? config.updatedAt : undefined,
  }
}

function loadCryptoProfile(): CryptoProfileConfig {
  const configPath = getCryptoProfilePath()
  if (!existsSync(configPath)) return normalizeCryptoProfile()

  try {
    const rawProfile = JSON.parse(readFileSync(configPath, 'utf8'))
    return normalizeCryptoProfile({
      ...rawProfile,
      localSecret: unprotectLocalSecret(rawProfile.localSecret),
      sharedVaultSecret: unprotectLocalSecret(rawProfile.sharedVaultSecret),
    })
  } catch (error) {
    console.error('读取本地加密配置失败:', error)
    return normalizeCryptoProfile()
  }
}

function saveCryptoProfile(config: Partial<CryptoProfileConfig>) {
  const normalizedProfile = normalizeCryptoProfile({
    ...config,
    updatedAt: new Date().toISOString(),
  })

  writeFileSync(
    getCryptoProfilePath(),
    JSON.stringify(
      {
        ...normalizedProfile,
        localSecret: protectLocalSecret(normalizedProfile.localSecret),
        sharedVaultSecret: protectLocalSecret(normalizedProfile.sharedVaultSecret),
      },
      null,
      2
    ),
    { mode: 0o600 }
  )

  return normalizedProfile
}

function normalizeBackendConfig(config?: Partial<BackendConfig> | null): BackendConfig | null {
  const backendUrl = typeof config?.backendUrl === 'string' ? config.backendUrl.trim() : ''
  const workspaceKey = typeof config?.workspaceKey === 'string' ? config.workspaceKey.trim() : ''

  if (!backendUrl || !workspaceKey) return null
  return { backendUrl, workspaceKey }
}

function loadBackendConfig(): BackendConfig | null {
  const configPath = getAppConfigPath()
  if (!existsSync(configPath)) return null

  try {
    return normalizeBackendConfig(JSON.parse(readFileSync(configPath, 'utf8')))
  } catch (error) {
    console.error('读取应用配置失败:', error)
    return null
  }
}

function saveBackendConfig(config: BackendConfig) {
  const normalizedConfig = normalizeBackendConfig(config)
  if (!normalizedConfig) {
    throw new Error('后端地址和工作区 Key 不能为空')
  }

  writeFileSync(getAppConfigPath(), JSON.stringify(normalizedConfig, null, 2), {
    mode: 0o600,
  })
  return normalizedConfig
}

function clearBackendConfig() {
  writeFileSync(getAppConfigPath(), JSON.stringify({}, null, 2), {
    mode: 0o600,
  })
}

function normalizeLocalApiConfig(config?: Partial<LocalApiConfig> | null): LocalApiConfig {
  const port = Number(config?.port)
  const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : ''

  return {
    enabled: Boolean(config?.enabled),
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_LOCAL_API_PORT,
    apiKey,
  }
}

function loadLocalApiConfig(): LocalApiConfig {
  const configPath = getLocalApiConfigPath()
  if (!existsSync(configPath)) return localApiConfig

  try {
    return normalizeLocalApiConfig(JSON.parse(readFileSync(configPath, 'utf8')))
  } catch (error) {
    console.error('读取本地 API 配置失败:', error)
    return localApiConfig
  }
}

function saveLocalApiConfig(config: LocalApiConfig) {
  writeFileSync(getLocalApiConfigPath(), JSON.stringify(config, null, 2), {
    mode: 0o600,
  })
}

function getLocalApiStatus(config = localApiConfig): LocalApiStatus {
  return {
    ...config,
    requestUrl: `http://127.0.0.1:${config.port}/v1/credentials`,
    isRunning: Boolean(localApiServer),
    lastError: localApiLastError,
  }
}

function generateLocalApiKey() {
  return randomBytes(32).toString('hex')
}

function generateCryptoSecret() {
  return randomBytes(32).toString('hex')
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  if (response.headersSent || response.destroyed) return

  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-MacMima-Local-Api-Key',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function getHeaderValue(header: string | string[] | undefined) {
  return Array.isArray(header) ? header[0] : header || ''
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isLocalApiRequestAuthorized(request: IncomingMessage) {
  if (!localApiConfig.apiKey) return false

  const authorization = getHeaderValue(request.headers.authorization)
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim()
  const headerKey = getHeaderValue(request.headers['x-macmima-local-api-key']).trim()

  return safeCompare(bearerToken || headerKey, localApiConfig.apiKey)
}

function readJsonBody(request: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 512 * 1024) {
        reject(new Error('请求体过大'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('JSON 格式不正确'))
      }
    })
    request.on('error', reject)
  })
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((tag) => normalizeString(tag)).filter(Boolean)
}

function normalizeDatabaseTables(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((table) => ({
      name: normalizeString(table.name || table.tableName),
      description: normalizeString(table.description || table.remark || table.comment),
    }))
    .filter((table) => table.name || table.description)
}

function inferCredentialCategory(input: Record<string, any>, data: Record<string, any>) {
  const category = normalizeString(input.category || input.kind)
  const type = normalizeString(input.type)
  const format = normalizeString(input.format || data.format)
  const allowed = ['server', 'website', 'api_key', 'database', 'document', 'other']

  if (allowed.includes(category)) return category
  if (allowed.includes(type)) return type
  if (format === 'markdown' || data.content || input.markdown || input.document) return 'document'
  if (data.database || data.connectionString || input.tables || input.databaseTables)
    return 'database'
  if (data.url) return 'website'
  if (data.apiKey || data.apiSecret || data.accessKeyId || data.accessKeySecret) return 'api_key'
  if (data.host) return 'server'

  return 'other'
}

function normalizeCredentialScope(input: Record<string, any>) {
  const scope = normalizeString(input.scope || input.visibility)
  return scope === 'shared' ? 'shared' : 'personal'
}

function normalizeCredentialPayload(input: Record<string, any>) {
  const data = isRecord(input.data) ? { ...input.data } : {}
  const copyFields = [
    'host',
    'port',
    'database',
    'username',
    'password',
    'connectionString',
    'notes',
    'url',
    'email',
    'service',
    'apiKey',
    'apiSecret',
    'accessKeyId',
    'accessKeySecret',
    'region',
    'endpoint',
    'quota',
    'expiresAt',
    'description',
    'content',
    'markdown',
    'sourceFileName',
  ]

  copyFields.forEach((field) => {
    if (input[field] !== undefined && data[field] === undefined) {
      data[field] = input[field]
    }
  })

  const category = inferCredentialCategory(input, data)
  if (category === 'document') {
    data.format = 'markdown'
    data.content = String(data.content || data.markdown || input.markdown || input.document || '')
    data.description = normalizeString(data.description || input.description)
    data.sourceFileName = normalizeString(
      data.sourceFileName || input.sourceFileName || input.fileName
    )
    delete data.markdown
  }

  if (category === 'database') {
    const databaseType = normalizeString(input.databaseType || input.dbType)
    const inputType = normalizeString(input.type)

    data.type = data.type || databaseType || (inputType !== 'database' ? inputType : '') || 'mysql'
    data.databaseTables = normalizeDatabaseTables(
      data.databaseTables || input.databaseTables || input.tables || input.tableRelations
    )
  }

  return {
    category,
    scope: normalizeCredentialScope(input),
    title:
      normalizeString(input.title) ||
      normalizeString(data.database) ||
      normalizeString(data.service) ||
      normalizeString(data.host) ||
      '本地 API 导入',
    tags: normalizeTags(input.tags),
    data,
  }
}

function completePendingLocalApiRequest(
  requestId: string,
  statusCode: number,
  body: Record<string, unknown>
) {
  const pending = pendingLocalApiRequests.get(requestId)
  if (!pending) return

  clearTimeout(pending.timeout)
  pendingLocalApiRequests.delete(requestId)
  sendJson(pending.response, statusCode, body)
}

function rejectAllPendingLocalApiRequests(statusCode: number, error: string) {
  pendingLocalApiRequests.forEach((_pending, requestId) => {
    completePendingLocalApiRequest(requestId, statusCode, { ok: false, error })
  })
}

async function handleLocalApiRequest(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization,Content-Type,X-MacMima-Local-Api-Key'
  )

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, { ok: true, enabled: localApiConfig.enabled })
    return
  }

  if (request.method !== 'POST' || requestUrl.pathname !== '/v1/credentials') {
    sendJson(response, 404, { ok: false, error: '接口不存在' })
    return
  }

  if (!isLocalApiRequestAuthorized(request)) {
    sendJson(response, 401, { ok: false, error: '本地 API Key 不正确' })
    return
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    sendJson(response, 423, { ok: false, error: 'MacMima 未打开或未解锁' })
    return
  }

  try {
    const body = await readJsonBody(request)
    if (!isRecord(body)) {
      sendJson(response, 400, { ok: false, error: '请求体必须是 JSON 对象' })
      return
    }

    const requestId = randomUUID()
    const timeout = setTimeout(() => {
      pendingLocalApiRequests.delete(requestId)
      sendJson(response, 504, { ok: false, error: '前端保存超时，请确认 MacMima 已解锁' })
    }, 30_000)

    pendingLocalApiRequests.set(requestId, { response, timeout })
    mainWindow.webContents.send('local-api:credential-request', {
      requestId,
      payload: normalizeCredentialPayload(body),
    })
  } catch (error: any) {
    sendJson(response, 400, { ok: false, error: error.message || '请求处理失败' })
  }
}

async function stopLocalApiServer() {
  if (!localApiServer) return

  const server = localApiServer
  localApiServer = null
  rejectAllPendingLocalApiRequests(503, '本地 API 已关闭')

  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
}

async function startLocalApiServer(config: LocalApiConfig) {
  if (!config.enabled) return
  if (!config.apiKey) throw new Error('请先生成本地 API Key')

  const server = createServer((request, response) => {
    handleLocalApiRequest(request, response).catch((error) => {
      sendJson(response, 500, { ok: false, error: error.message || '本地 API 服务异常' })
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(config.port, '127.0.0.1', () => {
      server.off('error', reject)
      localApiServer = server
      localApiLastError = null
      resolve()
    })
  })
}

async function applyLocalApiConfig(config: LocalApiConfig) {
  await stopLocalApiServer()
  localApiConfig = config

  try {
    await startLocalApiServer(config)
    localApiLastError = null
  } catch (error: any) {
    localApiLastError = error.message || '本地 API 启动失败'
    throw error
  } finally {
    updateTrayMenu()
  }
}

function shouldHideToTray() {
  return process.platform === 'win32' || process.platform === 'linux'
}

function getTrayIcon() {
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(process.resourcesPath, 'build', 'icon.png'),
    path.join(__dirname, '../build/icon.png'),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue

    const icon = nativeImage.createFromPath(candidate)
    if (!icon.isEmpty()) return icon.resize({ width: 16, height: 16 })
  }

  return nativeImage.createEmpty()
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function isMainWindowForeground() {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused())
}

function sendRendererNavigation(route?: string) {
  if (!route?.startsWith('/') || !mainWindow || mainWindow.isDestroyed()) return

  const send = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('app:navigate', route)
  }

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send)
    return
  }

  send()
}

function showNativeNotification(payload: AppNotificationPayload) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  const route = typeof payload.route === 'string' ? payload.route.trim() : ''

  if (!title || !ElectronNotification.isSupported()) return false

  const notification = new ElectronNotification({
    title,
    body,
    silent: false,
  })

  notification.on('click', () => {
    showMainWindow()
    sendRendererNavigation(route)
  })

  notification.show()

  if (process.platform === 'darwin') {
    app.dock?.bounce('informational')
  }

  return true
}

function updateTrayMenu() {
  if (!tray) return

  const apiStatus = localApiConfig.enabled
    ? localApiServer
      ? `本地 API: 运行中 (${localApiConfig.port})`
      : `本地 API: 未运行${localApiLastError ? ` - ${localApiLastError}` : ''}`
    : '本地 API: 未启用'

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 MacMima', click: showMainWindow },
      { label: apiStatus, enabled: false },
      { type: 'separator' },
      {
        label: '退出 MacMima',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
  )
}

function createTray() {
  if (!shouldHideToTray() || tray) return

  tray = new Tray(getTrayIcon())
  tray.setToolTip('MacMima')
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTrayMenu()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  localApiConfig = loadLocalApiConfig()

  createWindow()
  createTray()
  applyLocalApiConfig(localApiConfig).catch((error) => {
    console.error('启动本地 API 失败:', error)
  })

  // 注册全局快捷键 Cmd+Shift+P 快速启动
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      showMainWindow()
    }
  })

  // 注册锁定快捷键 Cmd+L
  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app:lock')
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      return
    }

    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  void stopLocalApiServer()
})

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

ipcMain.handle('app:is-window-focused', () => {
  return isMainWindowForeground()
})

ipcMain.handle('app:show-notification', (_event, payload: AppNotificationPayload) => {
  return showNativeNotification(payload)
})

ipcMain.handle('app:getLatestRelease', async () => {
  const response = await fetch(RELEASES_URL, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`检查更新失败: ${response.status}`)
  }

  return response.json()
})

ipcMain.handle('app:openExternal', async (_event, url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('只允许打开 http/https 链接')
  }

  await shell.openExternal(url)
})

ipcMain.handle('backend-config:get', () => {
  return loadBackendConfig()
})

ipcMain.handle('backend-config:set', (_event, config: BackendConfig) => {
  return saveBackendConfig(config)
})

ipcMain.handle('backend-config:clear', () => {
  clearBackendConfig()
  return true
})

ipcMain.handle('crypto-profile:get', () => {
  return loadCryptoProfile()
})

ipcMain.handle('crypto-profile:set', (_event, config: CryptoProfileConfig) => {
  return saveCryptoProfile(config)
})

ipcMain.handle('crypto-profile:generate-secret', () => {
  return generateCryptoSecret()
})

ipcMain.handle('local-api:get-config', () => {
  return getLocalApiStatus()
})

ipcMain.handle('local-api:generate-key', () => {
  return generateLocalApiKey()
})

ipcMain.handle('local-api:set-config', async (_event, nextConfig: Partial<LocalApiConfig>) => {
  const normalizedConfig = normalizeLocalApiConfig(nextConfig)

  if (normalizedConfig.enabled && !normalizedConfig.apiKey) {
    normalizedConfig.apiKey = generateLocalApiKey()
  }

  await applyLocalApiConfig(normalizedConfig)
  saveLocalApiConfig(normalizedConfig)

  return getLocalApiStatus(normalizedConfig)
})

ipcMain.on('local-api:credential-result', (_event, result) => {
  if (!result?.requestId) return

  if (result.ok) {
    completePendingLocalApiRequest(result.requestId, result.status || 201, {
      ok: true,
      credential: result.credential || null,
    })
    return
  }

  completePendingLocalApiRequest(result.requestId, result.status || 422, {
    ok: false,
    error: result.error || '保存失败',
  })
})

ipcMain.on('app:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('app:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('app:close', () => {
  mainWindow?.close()
})

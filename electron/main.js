const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const { createServer } = require('http')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { randomBytes, randomUUID, timingSafeEqual } = require('crypto')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'
const DEFAULT_LOCAL_API_PORT = 37621
const LOCAL_API_CONFIG_FILE = 'local-api.json'

let mainWindow = null
let localApiServer = null
let localApiLastError = null
const pendingLocalApiRequests = new Map()
let localApiConfig = {
  enabled: false,
  port: DEFAULT_LOCAL_API_PORT,
  apiKey: '',
}

function getLocalApiConfigPath() {
  return path.join(app.getPath('userData'), LOCAL_API_CONFIG_FILE)
}

function normalizeLocalApiConfig(config = null) {
  const port = Number(config && config.port)
  const apiKey = typeof (config && config.apiKey) === 'string' ? config.apiKey.trim() : ''

  return {
    enabled: Boolean(config && config.enabled),
    port:
      Number.isInteger(port) && port >= 1024 && port <= 65535
        ? port
        : DEFAULT_LOCAL_API_PORT,
    apiKey,
  }
}

function loadLocalApiConfig() {
  const configPath = getLocalApiConfigPath()
  if (!existsSync(configPath)) return localApiConfig

  try {
    return normalizeLocalApiConfig(JSON.parse(readFileSync(configPath, 'utf8')))
  } catch (error) {
    console.error('读取本地 API 配置失败:', error)
    return localApiConfig
  }
}

function saveLocalApiConfig(config) {
  writeFileSync(getLocalApiConfigPath(), JSON.stringify(config, null, 2), {
    mode: 0o600,
  })
}

function getLocalApiStatus(config = localApiConfig) {
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

function sendJson(response, statusCode, body) {
  if (response.headersSent || response.destroyed) return

  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-MacMima-Local-Api-Key',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function getHeaderValue(header) {
  return Array.isArray(header) ? header[0] : header || ''
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isLocalApiRequestAuthorized(request) {
  if (!localApiConfig.apiKey) return false

  const authorization = getHeaderValue(request.headers.authorization)
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim()
  const headerKey = getHeaderValue(request.headers['x-macmima-local-api-key']).trim()

  return safeCompare(bearerToken || headerKey, localApiConfig.apiKey)
}

function readJsonBody(request) {
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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return []

  return value.map((tag) => normalizeString(tag)).filter(Boolean)
}

function normalizeDatabaseTables(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((table) => ({
      name: normalizeString(table.name || table.tableName),
      description: normalizeString(table.description || table.remark || table.comment),
    }))
    .filter((table) => table.name || table.description)
}

function inferCredentialCategory(input, data) {
  const category = normalizeString(input.category || input.kind)
  const type = normalizeString(input.type)
  const allowed = ['server', 'website', 'api_key', 'database', 'other']

  if (allowed.includes(category)) return category
  if (allowed.includes(type)) return type
  if (data.database || data.connectionString || input.tables || input.databaseTables) return 'database'
  if (data.url) return 'website'
  if (data.apiKey || data.apiSecret || data.accessKeyId || data.accessKeySecret) return 'api_key'
  if (data.host) return 'server'

  return 'other'
}

function normalizeCredentialScope(input) {
  const scope = normalizeString(input.scope || input.visibility)
  return scope === 'shared' ? 'shared' : 'personal'
}

function normalizeCredentialPayload(input) {
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
  ]

  copyFields.forEach((field) => {
    if (input[field] !== undefined && data[field] === undefined) {
      data[field] = input[field]
    }
  })

  const category = inferCredentialCategory(input, data)
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

function completePendingLocalApiRequest(requestId, statusCode, body) {
  const pending = pendingLocalApiRequests.get(requestId)
  if (!pending) return

  clearTimeout(pending.timeout)
  pendingLocalApiRequests.delete(requestId)
  sendJson(pending.response, statusCode, body)
}

function rejectAllPendingLocalApiRequests(statusCode, error) {
  pendingLocalApiRequests.forEach((_pending, requestId) => {
    completePendingLocalApiRequest(requestId, statusCode, { ok: false, error })
  })
}

async function handleLocalApiRequest(request, response) {
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
    }, 30000)

    pendingLocalApiRequests.set(requestId, { response, timeout })
    mainWindow.webContents.send('local-api:credential-request', {
      requestId,
      payload: normalizeCredentialPayload(body),
    })
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message || '请求处理失败' })
  }
}

async function stopLocalApiServer() {
  if (!localApiServer) return

  const server = localApiServer
  localApiServer = null
  rejectAllPendingLocalApiRequests(503, '本地 API 已关闭')

  await new Promise((resolve) => {
    server.close(() => resolve())
  })
}

async function startLocalApiServer(config) {
  if (!config.enabled) return
  if (!config.apiKey) throw new Error('请先生成本地 API Key')

  const server = createServer((request, response) => {
    handleLocalApiRequest(request, response).catch((error) => {
      sendJson(response, 500, { ok: false, error: error.message || '本地 API 服务异常' })
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(config.port, '127.0.0.1', () => {
      server.off('error', reject)
      localApiServer = server
      localApiLastError = null
      resolve()
    })
  })
}

async function applyLocalApiConfig(config) {
  await stopLocalApiServer()
  localApiConfig = config

  try {
    await startLocalApiServer(config)
    localApiLastError = null
  } catch (error) {
    localApiLastError = error.message || '本地 API 启动失败'
    throw error
  }
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
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  localApiConfig = loadLocalApiConfig()

  createWindow()
  applyLocalApiConfig(localApiConfig).catch((error) => {
    console.error('启动本地 API 失败:', error)
  })

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app:lock')
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  void stopLocalApiServer()
})

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

ipcMain.handle('local-api:get-config', () => {
  return getLocalApiStatus()
})

ipcMain.handle('local-api:generate-key', () => {
  return generateLocalApiKey()
})

ipcMain.handle('local-api:set-config', async (_event, nextConfig) => {
  const normalizedConfig = normalizeLocalApiConfig(nextConfig)

  if (normalizedConfig.enabled && !normalizedConfig.apiKey) {
    normalizedConfig.apiKey = generateLocalApiKey()
  }

  await applyLocalApiConfig(normalizedConfig)
  saveLocalApiConfig(normalizedConfig)

  return getLocalApiStatus(normalizedConfig)
})

ipcMain.on('local-api:credential-result', (_event, result) => {
  if (!result || !result.requestId) return

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
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('app:maximize', () => {
  if (mainWindow && mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else if (mainWindow) {
    mainWindow.maximize()
  }
})

ipcMain.on('app:close', () => {
  if (mainWindow) mainWindow.close()
})

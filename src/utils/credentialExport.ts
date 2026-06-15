import { Credential } from '@/stores/credentialStore'

const fieldLabels: Record<string, string> = {
  accessKeyId: 'Access Key ID',
  accessKeySecret: 'Access Key Secret',
  apiKey: 'API Key',
  apiSecret: 'API Secret',
  connectionString: '连接字符串',
  database: '数据库名',
  databaseTables: '数据表说明',
  description: '说明',
  email: '邮箱',
  endpoint: '端点URL',
  expiresAt: '过期时间',
  content: 'Markdown正文',
  format: '格式',
  host: '主机地址',
  notes: '备注',
  password: '密码',
  port: '端口',
  privateKey: 'SSH私钥',
  privateKeyFileName: '私钥文件',
  protocol: '协议',
  quota: '配额',
  region: '区域',
  service: '服务名称',
  sourceFileName: '源文件',
  type: '数据库类型',
  url: '网址',
  username: '用户名',
}

const fieldOrder: Record<Credential['category'], string[]> = {
  server: ['host', 'port', 'protocol', 'username', 'password', 'privateKeyFileName', 'privateKey', 'notes'],
  website: ['url', 'username', 'email', 'password', 'notes'],
  api_key: [
    'service',
    'apiKey',
    'apiSecret',
    'accessKeyId',
    'accessKeySecret',
    'region',
    'endpoint',
    'quota',
    'expiresAt',
    'notes',
  ],
  database: [
    'type',
    'host',
    'port',
    'database',
    'username',
    'password',
    'connectionString',
    'databaseTables',
    'notes',
  ],
  document: ['description', 'sourceFileName', 'content', 'notes'],
  other: [],
}

function appendLine(lines: string[], label: string, value: unknown) {
  if (value === undefined || value === null || value === '') return

  const text = String(value)
  if (text.includes('\n')) {
    lines.push(`${label}:`)
    lines.push(text)
  } else {
    lines.push(`${label}: ${text}`)
  }
}

function formatDatabaseTable(table: any): string {
  const name = String(table?.name || '').trim()
  const description = String(table?.description || '').trim()

  if (name && description) return `${name}: ${description}`
  return name || description
}

function appendDatabaseTables(lines: string[], value: unknown) {
  if (!Array.isArray(value)) return

  const tableLines = value.map(formatDatabaseTable).filter(Boolean)
  if (tableLines.length === 0) return

  lines.push('数据表说明:')
  lines.push(...tableLines)
}

export function formatCredentialInfo(credential: Credential): string {
  const lines: string[] = []
  const data = credential.data || {}

  if (credential.category === 'document') {
    return String(data.content || '').trim()
  }

  const orderedFields = fieldOrder[credential.category] || []
  const usedFields = new Set<string>()

  appendLine(lines, '区域', credential.scope === 'shared' ? '共享密区' : '个人密区')

  orderedFields.forEach((field) => {
    usedFields.add(field)
    if (field === 'databaseTables') {
      appendDatabaseTables(lines, data[field])
      return
    }

    appendLine(lines, fieldLabels[field] || field, data[field])
  })

  Object.entries(data).forEach(([field, value]) => {
    if (!usedFields.has(field)) {
      if (field === 'databaseTables') {
        appendDatabaseTables(lines, value)
        return
      }

      appendLine(lines, fieldLabels[field] || field, value)
    }
  })

  return lines.filter((line, index, array) => !(line === '' && array[index - 1] === '')).join('\n')
}

export function canDownloadPrivateKey(credential: Credential): boolean {
  return credential.category === 'server' && Boolean(credential.data?.privateKey)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ssh-private-key'
}

export function downloadPrivateKey(credential: Credential) {
  const privateKey = credential.data?.privateKey
  if (!privateKey) return

  const sourceName = credential.data?.privateKeyFileName || `${credential.title}.pem`
  let fileName = sanitizeFileName(String(sourceName))

  if (!/\.[^/.]+$/.test(fileName)) {
    fileName = `${fileName}.pem`
  }

  const blob = new Blob([privateKey], {
    type: 'application/x-pem-file;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

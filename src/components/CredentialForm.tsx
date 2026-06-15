import { useState } from 'react'
import { FileText, Plus, Trash2, Upload, X, Save, Wand2 } from 'lucide-react'
import PasswordGenerator from './PasswordGenerator'

type CredentialCategory = 'server' | 'website' | 'api_key' | 'database' | 'document' | 'other'

interface CredentialFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  category?: CredentialCategory
  onSave: (data: any) => void
  onCancel: () => void
}

export default function CredentialForm({
  mode,
  initialData,
  category = 'server',
  onSave,
  onCancel,
}: CredentialFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<CredentialCategory>(
    initialData?.category || category
  )
  const [scope, setScope] = useState<'personal' | 'shared'>(initialData?.scope || 'personal')
  const [title, setTitle] = useState(initialData?.title || '')
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false)
  const [currentPasswordField, setCurrentPasswordField] = useState<string>('')

  // 表单数据
  const [formData, setFormData] = useState(initialData?.data || {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      alert('请输入标题')
      return
    }

    if (selectedCategory === 'document' && !String(formData.content || '').trim()) {
      alert('请输入 Markdown 正文')
      return
    }

    onSave({
      category: selectedCategory,
      scope,
      title: title.trim(),
      tags,
      data: getNormalizedFormData(),
    })
  }

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const updateFields = (fields: Record<string, string>) => {
    setFormData({ ...formData, ...fields })
  }

  const handlePrivateKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return

    const maxKeyFileSize = 256 * 1024
    if (file.size > maxKeyFileSize) {
      alert('私钥文件过大，请选择 256KB 以内的密钥文件')
      return
    }

    const content = await file.text()
    updateFields({
      privateKey: content.trimEnd(),
      privateKeyFileName: file.name,
    })
  }

  const handleMarkdownFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return

    const maxDocumentFileSize = 1024 * 1024
    if (file.size > maxDocumentFileSize) {
      alert('Markdown 文件过大，请选择 1MB 以内的文档')
      return
    }

    const content = await file.text()
    updateFields({
      content: content.trimEnd(),
      sourceFileName: file.name,
      format: 'markdown',
    })
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const openPasswordGenerator = (fieldName: string) => {
    setCurrentPasswordField(fieldName)
    setShowPasswordGenerator(true)
  }

  const handlePasswordGenerated = (password: string) => {
    updateField(currentPasswordField, password)
  }

  const getDatabaseTables = () => {
    return Array.isArray(formData.databaseTables) ? formData.databaseTables : []
  }

  const getNormalizedFormData = () => {
    if (selectedCategory === 'document') {
      const content = String(formData.content || '')
      const description = String(formData.description || '').trim()
      const sourceFileName = String(formData.sourceFileName || '').trim()
      const notes = String(formData.notes || '').trim()

      return {
        format: 'markdown',
        content,
        ...(description ? { description } : {}),
        ...(sourceFileName ? { sourceFileName } : {}),
        ...(notes ? { notes } : {}),
      }
    }

    if (selectedCategory !== 'database') {
      return formData
    }

    const databaseTables = getDatabaseTables()
      .map((table: any) => ({
        name: String(table.name || '').trim(),
        description: String(table.description || '').trim(),
      }))
      .filter((table: any) => table.name || table.description)

    if (databaseTables.length === 0) {
      const { databaseTables: _databaseTables, ...rest } = formData
      return rest
    }

    return { ...formData, databaseTables }
  }

  const updateDatabaseTable = (
    index: number,
    field: 'name' | 'description',
    value: string
  ) => {
    const databaseTables = getDatabaseTables().map((table: any, tableIndex: number) =>
      tableIndex === index ? { ...table, [field]: value } : table
    )
    setFormData({ ...formData, databaseTables })
  }

  const addDatabaseTable = () => {
    setFormData({
      ...formData,
      databaseTables: [...getDatabaseTables(), { name: '', description: '' }],
    })
  }

  const removeDatabaseTable = (index: number) => {
    setFormData({
      ...formData,
      databaseTables: getDatabaseTables().filter(
        (_: any, tableIndex: number) => tableIndex !== index
      ),
    })
  }

  const renderServerFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">主机地址 *</label>
        <input
          type="text"
          value={formData.host || ''}
          onChange={(e) => updateField('host', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="例: 192.168.1.100 或 example.com"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">端口</label>
          <input
            type="text"
            value={formData.port || ''}
            onChange={(e) => updateField('port', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="22"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">协议</label>
          <select
            value={formData.protocol || 'ssh'}
            onChange={(e) => updateField('protocol', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="ssh">SSH</option>
            <option value="rdp">RDP</option>
            <option value="vnc">VNC</option>
            <option value="telnet">Telnet</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
        <input
          type="text"
          value={formData.username || ''}
          onChange={(e) => updateField('username', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="root"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={formData.password || ''}
            onChange={(e) => updateField('password', e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => openPasswordGenerator('password')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Wand2 size={18} />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">SSH私钥</label>
          <div className="flex items-center gap-2">
            {formData.privateKeyFileName && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 max-w-[220px] truncate">
                <FileText size={14} />
                {formData.privateKeyFileName}
              </span>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors cursor-pointer text-sm font-medium">
              <Upload size={16} />
              选择文件
              <input
                type="file"
                accept=".pem,.key,.ppk,.txt"
                onChange={handlePrivateKeyFile}
                className="hidden"
              />
            </label>
            {(formData.privateKey || formData.privateKeyFileName) && (
              <button
                type="button"
                onClick={() => updateFields({ privateKey: '', privateKeyFileName: '' })}
                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="清除私钥"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <textarea
          value={formData.privateKey || ''}
          onChange={(e) => updateField('privateKey', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          rows={6}
          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="添加备注信息..."
        />
      </div>
    </>
  )

  const renderWebsiteFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">网址 *</label>
        <input
          type="url"
          value={formData.url || ''}
          onChange={(e) => updateField('url', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="https://example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
        <input
          type="text"
          value={formData.username || ''}
          onChange={(e) => updateField('username', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="用户名"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
        <input
          type="email"
          value={formData.email || ''}
          onChange={(e) => updateField('email', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="user@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={formData.password || ''}
            onChange={(e) => updateField('password', e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => openPasswordGenerator('password')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Wand2 size={18} />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="添加备注信息..."
        />
      </div>
    </>
  )

  const renderApiKeyFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">服务名称 *</label>
        <input
          type="text"
          value={formData.service || ''}
          onChange={(e) => updateField('service', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="例: OpenAI, AWS, 阿里云"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
        <input
          type="text"
          value={formData.apiKey || ''}
          onChange={(e) => updateField('apiKey', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          placeholder="sk-..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">API Secret</label>
        <input
          type="password"
          value={formData.apiSecret || ''}
          onChange={(e) => updateField('apiSecret', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Access Key ID</label>
        <input
          type="text"
          value={formData.accessKeyId || ''}
          onChange={(e) => updateField('accessKeyId', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          placeholder="LTAI..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Access Key Secret</label>
        <input
          type="password"
          value={formData.accessKeySecret || ''}
          onChange={(e) => updateField('accessKeySecret', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          placeholder="••••••••"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">区域</label>
          <input
            type="text"
            value={formData.region || ''}
            onChange={(e) => updateField('region', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="us-east-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">配额</label>
          <input
            type="text"
            value={formData.quota || ''}
            onChange={(e) => updateField('quota', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="unlimited"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">端点URL</label>
        <input
          type="url"
          value={formData.endpoint || ''}
          onChange={(e) => updateField('endpoint', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="https://api.example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">过期时间</label>
        <input
          type="date"
          value={formData.expiresAt || ''}
          onChange={(e) => updateField('expiresAt', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="添加备注信息..."
        />
      </div>
    </>
  )

  const renderDatabaseFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">数据库类型 *</label>
        <select
          value={formData.type || 'mysql'}
          onChange={(e) => updateField('type', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="mysql">MySQL</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="redis">Redis</option>
          <option value="sqlite">SQLite</option>
          <option value="mssql">SQL Server</option>
          <option value="oracle">Oracle</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">主机地址 *</label>
          <input
            type="text"
            value={formData.host || ''}
            onChange={(e) => updateField('host', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="localhost"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">端口</label>
          <input
            type="text"
            value={formData.port || ''}
            onChange={(e) => updateField('port', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="3306"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">数据库名</label>
        <input
          type="text"
          value={formData.database || ''}
          onChange={(e) => updateField('database', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="mydb"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
        <input
          type="text"
          value={formData.username || ''}
          onChange={(e) => updateField('username', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="root"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={formData.password || ''}
            onChange={(e) => updateField('password', e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => openPasswordGenerator('password')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Wand2 size={18} />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">连接字符串</label>
        <textarea
          value={formData.connectionString || ''}
          onChange={(e) => updateField('connectionString', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          rows={2}
          placeholder="mysql://user:password@host:3306/database"
        />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-900">数据表说明</label>
            <p className="text-xs text-gray-500 mt-1">保存该数据库中的表名和对应用途说明。</p>
          </div>
          <button
            type="button"
            onClick={addDatabaseTable}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            添加表
          </button>
        </div>

        {getDatabaseTables().length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg bg-white">
            暂无数据表说明
          </div>
        ) : (
          <div className="space-y-3">
            {getDatabaseTables().map((table: any, index: number) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-3">
                <input
                  type="text"
                  value={table.name || ''}
                  onChange={(e) => updateDatabaseTable(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="表名"
                />
                <input
                  type="text"
                  value={table.description || ''}
                  onChange={(e) => updateDatabaseTable(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="说明"
                />
                <button
                  type="button"
                  onClick={() => removeDatabaseTable(index)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="删除"
                  aria-label="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="添加备注信息..."
        />
      </div>
    </>
  )

  const renderDocumentFields = () => (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">文档说明</label>
          <div className="flex items-center gap-2">
            {formData.sourceFileName && (
              <span className="inline-flex max-w-[220px] items-center gap-1 truncate text-xs text-gray-500">
                <FileText size={14} />
                {formData.sourceFileName}
              </span>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100">
              <Upload size={16} />
              导入 Markdown
              <input
                type="file"
                accept=".md,.markdown,.txt"
                onChange={handleMarkdownFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <textarea
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="例: OpenAI Responses API 请求示例、Webhook 对接说明"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Markdown 正文 *</label>
        <textarea
          value={formData.content || ''}
          onChange={(e) => updateField('content', e.target.value)}
          className="min-h-[360px] w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={
            '# API 请求文档\n\n## Endpoint\nPOST /v1/example\n\n```json\n{\n  "name": "demo"\n}\n```'
          }
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="补充维护说明、适用环境或更新时间..."
        />
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            {selectedCategory === 'document'
              ? mode === 'create'
                ? '创建文档'
                : '编辑文档'
              : mode === 'create'
                ? '创建凭证'
                : '编辑凭证'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 基本信息 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">类型 *</label>
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as typeof selectedCategory)
                }
                disabled={mode === 'edit'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                required
              >
                <option value="server">服务器</option>
                <option value="website">网站</option>
                <option value="api_key">API密钥</option>
                <option value="database">数据库</option>
                <option value="document">Markdown文档</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例: 生产服务器、GitHub账号"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">区域</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    scope === 'personal'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  个人密区
                </button>
                <button
                  type="button"
                  onClick={() => setScope('shared')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    scope === 'shared'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  共享密区
                </button>
              </div>
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="输入标签后按回车"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  添加
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 根据类型渲染不同的字段 */}
            {selectedCategory === 'server' && renderServerFields()}
            {selectedCategory === 'website' && renderWebsiteFields()}
            {selectedCategory === 'api_key' && renderApiKeyFields()}
            {selectedCategory === 'database' && renderDatabaseFields()}
            {selectedCategory === 'document' && renderDocumentFields()}
          </div>
        </form>

        {/* 底部按钮 */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </div>

      {/* 密码生成器 */}
      {showPasswordGenerator && (
        <PasswordGenerator
          onClose={() => setShowPasswordGenerator(false)}
          onSelect={handlePasswordGenerated}
        />
      )}
    </div>
  )
}

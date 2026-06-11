import { useState } from 'react'
import {
  X,
  Copy,
  Eye,
  EyeOff,
  Check,
  Server,
  Globe,
  Key,
  Database,
  Edit,
  Trash2,
  Star,
  Clock,
  Download,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Credential } from '@/stores/credentialStore'
import { copyToClipboard } from '@/utils/clipboard'
import {
  canDownloadPrivateKey,
  downloadPrivateKey,
  formatCredentialInfo,
} from '@/utils/credentialExport'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface CredentialDetailProps {
  credential: Credential
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleFavorite?: () => void
}

export default function CredentialDetail({
  credential,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
}: CredentialDetailProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const data = credential.data || {}

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleCopyAll = () => {
    handleCopy(formatCredentialInfo(credential), 'all')
  }

  const handleDownloadPrivateKey = () => {
    downloadPrivateKey(credential)
  }

  const getCategoryIcon = () => {
    switch (credential.category) {
      case 'server':
        return <Server size={24} className="text-primary-600" />
      case 'website':
        return <Globe size={24} className="text-gray-700" />
      case 'api_key':
        return <Key size={24} className="text-gray-700" />
      case 'database':
        return <Database size={24} className="text-primary-600" />
      default:
        return <Key size={24} className="text-gray-600" />
    }
  }

  const ScopeIcon = credential.scope === 'shared' ? UsersRound : UserRound
  const scopeLabel = credential.scope === 'shared' ? '共享密区' : '个人密区'

  const renderField = (label: string, value: string, fieldKey: string, isSecret = false) => {
    if (!value) return null

    const displayValue = isSecret && !showPassword ? '••••••••' : value

    return (
      <div key={fieldKey} className="py-3 border-b border-gray-100 last:border-0">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div className="flex items-center gap-2">
            {isSecret && (
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            <button
              onClick={() => handleCopy(value, fieldKey)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="复制"
            >
              {copiedField === fieldKey ? (
                <Check size={16} className="text-gray-900" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>
        <div className={`text-sm ${isSecret ? 'font-mono' : ''} text-gray-900 break-all`}>
          {displayValue}
        </div>
      </div>
    )
  }

  const getDatabaseTables = () => {
    if (!Array.isArray(data.databaseTables)) return []

    return data.databaseTables
      .map((table: any) => ({
        name: String(table?.name || '').trim(),
        description: String(table?.description || '').trim(),
      }))
      .filter((table: any) => table.name || table.description)
  }

  const formatDatabaseTable = (table: { name: string; description: string }) => {
    if (table.name && table.description) return `${table.name}: ${table.description}`
    return table.name || table.description
  }

  const renderDatabaseTables = () => {
    const databaseTables = getDatabaseTables()
    if (databaseTables.length === 0) return null

    return (
      <div className="py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">数据表说明</label>
          <button
            onClick={() =>
              handleCopy(databaseTables.map(formatDatabaseTable).join('\n'), 'databaseTables')
            }
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="复制全部表说明"
          >
            {copiedField === 'databaseTables' ? (
              <Check size={16} className="text-gray-900" />
            ) : (
              <Copy size={16} />
            )}
          </button>
        </div>
        <div className="space-y-2">
          {databaseTables.map((table: any, index: number) => {
            const fieldKey = `databaseTable-${index}`

            return (
              <div
                key={fieldKey}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  {table.name && (
                    <div className="font-mono text-sm text-gray-900 break-all">{table.name}</div>
                  )}
                  {table.description && (
                    <div className="mt-1 text-sm text-gray-600 break-words">
                      {table.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(formatDatabaseTable(table), fieldKey)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="复制表名和说明"
                >
                  {copiedField === fieldKey ? (
                    <Check size={16} className="text-gray-900" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderFields = () => {
    switch (credential.category) {
      case 'server':
        return (
          <>
            {renderField('主机地址', data.host, 'host')}
            {renderField('端口', data.port, 'port')}
            {renderField('用户名', data.username, 'username')}
            {renderField('密码', data.password, 'password', true)}
            {renderField('协议', data.protocol, 'protocol')}
            {renderField('私钥文件', data.privateKeyFileName, 'privateKeyFileName')}
            {renderField('私钥', data.privateKey, 'privateKey', true)}
            {renderField('备注', data.notes, 'notes')}
          </>
        )

      case 'website':
        return (
          <>
            {renderField('网址', data.url, 'url')}
            {renderField('用户名', data.username, 'username')}
            {renderField('邮箱', data.email, 'email')}
            {renderField('密码', data.password, 'password', true)}
            {renderField('备注', data.notes, 'notes')}
          </>
        )

      case 'api_key':
        return (
          <>
            {renderField('服务名称', data.service, 'service')}
            {renderField('API Key', data.apiKey, 'apiKey', true)}
            {renderField('API Secret', data.apiSecret, 'apiSecret', true)}
            {renderField('Access Key ID', data.accessKeyId, 'accessKeyId', true)}
            {renderField('Access Key Secret', data.accessKeySecret, 'accessKeySecret', true)}
            {renderField('区域', data.region, 'region')}
            {renderField('端点', data.endpoint, 'endpoint')}
            {renderField('配额', data.quota, 'quota')}
            {renderField('过期时间', data.expiresAt, 'expiresAt')}
            {renderField('备注', data.notes, 'notes')}
          </>
        )

      case 'database':
        return (
          <>
            {renderField('数据库类型', data.type, 'type')}
            {renderField('主机地址', data.host, 'host')}
            {renderField('端口', data.port, 'port')}
            {renderField('数据库名', data.database, 'database')}
            {renderField('用户名', data.username, 'username')}
            {renderField('密码', data.password, 'password', true)}
            {renderField('连接字符串', data.connectionString, 'connectionString', true)}
            {renderDatabaseTables()}
            {renderField('备注', data.notes, 'notes')}
          </>
        )

      default:
        return Object.entries(data).map(([key, value]) =>
          renderField(key, String(value), key, key.includes('password') || key.includes('secret'))
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-200">
          <div className="p-3 bg-gray-50 rounded-lg">{getCategoryIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-semibold text-gray-900">{credential.title}</h2>
              {credential.favorite && (
                <Star size={20} className="text-gray-900 fill-gray-900" />
              )}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              <ScopeIcon size={14} />
              {scopeLabel}
            </div>
            {credential.tags && credential.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {credential.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-1">{renderFields()}</div>

          {/* 元数据 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Clock size={14} />
                  <span>创建时间</span>
                </div>
                <div className="text-gray-900">
                  {format(new Date(credential.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Clock size={14} />
                  <span>最后修改</span>
                </div>
                <div className="text-gray-900">
                  {format(new Date(credential.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCopyAll}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            {copiedField === 'all' ? (
              <Check size={18} className="text-gray-900" />
            ) : (
              <Copy size={18} />
            )}
            复制全部
          </button>
          {canDownloadPrivateKey(credential) && (
            <button
              onClick={handleDownloadPrivateKey}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              下载私钥
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Star
                size={18}
                className={credential.favorite ? 'fill-gray-900 text-gray-900' : ''}
              />
              {credential.favorite ? '取消收藏' : '添加收藏'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit size={18} />
              编辑
            </button>
          )}
          <div className="flex-1" />
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

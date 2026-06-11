import { useState } from 'react'
import {
  Server,
  Globe,
  Key,
  Database,
  Star,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Check,
  Download,
  UsersRound,
  UserRound,
} from 'lucide-react'
import { Credential } from '@/stores/credentialStore'
import { copyToClipboard } from '@/utils/clipboard'
import {
  canDownloadPrivateKey,
  downloadPrivateKey,
  formatCredentialInfo,
} from '@/utils/credentialExport'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface CredentialCardProps {
  credential: Credential
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleFavorite?: () => void
}

export default function CredentialCard({
  credential,
  onClick,
  onEdit,
  onDelete,
  onToggleFavorite,
}: CredentialCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const getCategoryIcon = () => {
    switch (credential.category) {
      case 'server':
        return <Server size={20} className="text-primary-600" />
      case 'website':
        return <Globe size={20} className="text-gray-700" />
      case 'api_key':
        return <Key size={20} className="text-gray-700" />
      case 'database':
        return <Database size={20} className="text-primary-600" />
      default:
        return <Key size={20} className="text-gray-600" />
    }
  }

  const getCategoryLabel = () => {
    switch (credential.category) {
      case 'server':
        return '服务器'
      case 'website':
        return '网站'
      case 'api_key':
        return 'API密钥'
      case 'database':
        return '数据库'
      default:
        return '其他'
    }
  }

  const getScopeLabel = () => (credential.scope === 'shared' ? '共享密区' : '个人密区')
  const ScopeIcon = credential.scope === 'shared' ? UsersRound : UserRound

  const handleCopy = async (text: string, field: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleCopyAll = async (e: React.MouseEvent) => {
    await handleCopy(formatCredentialInfo(credential), 'all', e)
  }

  const handleDownloadPrivateKey = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadPrivateKey(credential)
    setShowMenu(false)
  }

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      })
    } catch {
      return ''
    }
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer relative group"
    >
      {/* 顶部：图标、标题、收藏 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-gray-50 rounded-lg">{getCategoryIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">{credential.title}</h3>
            {credential.favorite && (
              <Star size={16} className="text-gray-900 fill-gray-900 flex-shrink-0" />
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>{getCategoryLabel()}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              <ScopeIcon size={12} />
              {getScopeLabel()}
            </span>
          </div>
        </div>

        {/* 更多操作菜单 */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite()
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Star size={16} />
                    {credential.favorite ? '取消收藏' : '添加收藏'}
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Edit size={16} />
                    编辑
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 标签 */}
      {credential.tags && credential.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {credential.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {credential.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{credential.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 底部：时间信息 */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {credential.lastUsed
            ? `最后使用 ${formatTime(credential.lastUsed)}`
            : `创建于 ${formatTime(credential.createdAt)}`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            title="复制全部信息"
            aria-label="复制全部信息"
          >
            {copiedField === 'all' ? <Check size={16} /> : <Copy size={16} />}
          </button>

          {canDownloadPrivateKey(credential) && (
            <button
              onClick={handleDownloadPrivateKey}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="下载私钥文件"
              aria-label="下载私钥文件"
            >
              <Download size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

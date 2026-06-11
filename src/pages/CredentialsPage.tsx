import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Database, Globe, KeyRound, ListFilter, Plus, Search, Server } from 'lucide-react'
import { useCredentialStore } from '@/stores/credentialStore'
import { useAuthStore } from '@/stores/authStore'
import { api, getBackendConfig } from '@/services/api'
import { decryptData, deriveWorkspaceSharedKey, encryptData } from '@/utils/crypto'
import CredentialCard from '@/components/CredentialCard'
import CredentialDetail from '@/components/CredentialDetail'
import CredentialForm from '@/components/CredentialForm'
import PageShell from '@/components/layouts/PageShell'

interface CredentialsPageProps {
  filter?: 'personal' | 'shared' | 'favorites' | 'trash'
}

interface ApiCredential {
  id: string
  userId: string
  scope?: 'personal' | 'shared'
  category: 'server' | 'website' | 'api_key' | 'database' | 'other'
  title: string
  encryptedData: string
  iv: string
  authTag: string
  tags: string[] | null
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastUsed?: string | null
}

type CredentialCategory = ApiCredential['category']
type CategoryFilter = 'all' | CredentialCategory

const categoryOptions: Array<{
  value: CategoryFilter
  label: string
  icon: typeof ListFilter
}> = [
  { value: 'all', label: '全部', icon: ListFilter },
  { value: 'server', label: '服务器', icon: Server },
  { value: 'website', label: '网站', icon: Globe },
  { value: 'api_key', label: 'API', icon: KeyRound },
  { value: 'database', label: '数据库', icon: Database },
  { value: 'other', label: '其他', icon: KeyRound },
]

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

export default function CredentialsPage({ filter }: CredentialsPageProps) {
  const { category } = useParams()
  const { masterKey, user } = useAuthStore()
  const {
    credentials,
    isLoading,
    error,
    setCredentials,
    addCredential,
    updateCredential,
    deleteCredential,
    setLoading,
    setError,
  } = useCredentialStore()

  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  const defaultScope: 'personal' | 'shared' = filter === 'shared' ? 'shared' : 'personal'
  const effectiveCategory = (category as CredentialCategory | undefined) || activeCategory

  const getTitle = () => {
    if (filter === 'shared') return '共享密区'
    if (filter === 'personal') return '个人密区'
    if (filter === 'favorites') return '收藏夹'
    if (filter === 'trash') return '回收站'
    if (category === 'server') return '服务器'
    if (category === 'website') return '网站'
    if (category === 'api_key') return 'API密钥'
    if (category === 'database') return '数据库'
    return '所有项目'
  }

  const getSharedKey = async () => {
    const workspaceKey = getBackendConfig()?.workspaceKey
    if (!workspaceKey) {
      throw new Error('请先配置工作区 Key')
    }

    return deriveWorkspaceSharedKey(workspaceKey)
  }

  const getEncryptionKey = async (scope: 'personal' | 'shared') => {
    if (scope === 'shared') {
      return getSharedKey()
    }

    if (!masterKey) {
      throw new Error('请先登录解锁主密钥')
    }

    return masterKey
  }

  useEffect(() => {
    if (!masterKey) return

    const loadCredentials = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await api.get('/credentials', {
          params: {
            limit: 200,
            ...(filter === 'shared' ? { scope: 'shared' } : {}),
            ...(filter === 'personal' ? { scope: 'personal' } : {}),
            ...(effectiveCategory !== 'all' ? { category: effectiveCategory } : {}),
          },
        })
        const payload = unwrapResponseData<{
          credentials: ApiCredential[]
        }>(response)
        const hasSharedCredentials = payload.credentials.some((item) => item.scope === 'shared')
        const sharedKey = hasSharedCredentials ? await getSharedKey() : null

        const decryptedCredentials = await Promise.all(
          payload.credentials.map(async (item) => {
            const credentialScope = item.scope || 'personal'
            const decryptKey = credentialScope === 'shared' ? sharedKey! : masterKey
            const decryptedJson = await decryptData(
              {
                encrypted: item.encryptedData,
                iv: item.iv,
                authTag: item.authTag,
              },
              decryptKey
            )

            return {
              id: item.id,
              userId: item.userId,
              scope: credentialScope,
              category: item.category,
              title: item.title,
              data: JSON.parse(decryptedJson),
              tags: Array.isArray(item.tags) ? item.tags : [],
              favorite: item.favorite,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              lastUsed: item.lastUsed || undefined,
            }
          })
        )

        setCredentials(decryptedCredentials)
      } catch (loadError: any) {
        console.error('加载凭证失败:', loadError)
        setError(loadError.message || '加载凭证失败')
      } finally {
        setLoading(false)
      }
    }

    loadCredentials()
  }, [effectiveCategory, filter, masterKey, setCredentials, setError, setLoading])

  // 过滤凭证
  const filteredCredentials = credentials.filter((cred) => {
    // 按过滤器筛选
    if (filter === 'personal' && cred.scope === 'shared') return false
    if (filter === 'shared' && cred.scope !== 'shared') return false
    if (filter === 'favorites' && !cred.favorite) return false
    if (filter === 'trash') return false // TODO: 实现回收站

    // 按分类筛选
    if (effectiveCategory !== 'all' && cred.category !== effectiveCategory) return false

    // 按搜索查询筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        cred.title.toLowerCase().includes(query) ||
        cred.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    return true
  })

  const handleCreate = () => {
    setEditMode(false)
    setSelectedCredential({ scope: defaultScope })
    setShowForm(true)
  }

  const handleEdit = (credential: any) => {
    if (!canManageCredential(credential)) return

    setEditMode(true)
    setSelectedCredential(credential)
    setShowDetail(false)
    setShowForm(true)
  }

  const handleSave = async (data: any) => {
    if (!masterKey) {
      alert('请先登录解锁主密钥')
      return
    }

    try {
      const credentialScope = data.scope === 'shared' ? 'shared' : 'personal'
      const encryptionKey = await getEncryptionKey(credentialScope)
      const encrypted = await encryptData(JSON.stringify(data.data), encryptionKey)

      if (editMode && selectedCredential) {
        const response = await api.put(`/credentials/${selectedCredential.id}`, {
          scope: credentialScope,
          title: data.title,
          encryptedData: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          tags: data.tags || [],
        })
        const saved = unwrapResponseData<ApiCredential>(response)

        updateCredential(selectedCredential.id, {
          scope: saved.scope || credentialScope,
          title: saved.title,
          data: data.data,
          tags: Array.isArray(saved.tags) ? saved.tags : data.tags || [],
          updatedAt: saved.updatedAt,
        })
      } else {
        const response = await api.post('/credentials', {
          category: data.category,
          scope: credentialScope,
          title: data.title,
          encryptedData: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          tags: data.tags || [],
        })
        const saved = unwrapResponseData<ApiCredential>(response)

        addCredential({
          id: saved.id,
          userId: saved.userId,
          scope: saved.scope || credentialScope,
          category: saved.category,
          title: saved.title,
          data: data.data,
          tags: Array.isArray(saved.tags) ? saved.tags : data.tags || [],
          favorite: saved.favorite,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          lastUsed: saved.lastUsed || undefined,
        })
      }

      setShowForm(false)
      setSelectedCredential(null)
    } catch (saveError: any) {
      console.error('保存凭证失败:', saveError)
      alert(saveError.response?.data?.error || saveError.message || '保存凭证失败')
    }
  }

  const handleDelete = async (credential: any) => {
    if (!canManageCredential(credential)) return

    if (confirm(`确定要删除"${credential.title}"吗？`)) {
      try {
        await api.delete(`/credentials/${credential.id}`)
        deleteCredential(credential.id)
        setShowDetail(false)
        setSelectedCredential(null)
      } catch (deleteError: any) {
        console.error('删除凭证失败:', deleteError)
        alert(deleteError.response?.data?.error || deleteError.message || '删除凭证失败')
      }
    }
  }

  const handleToggleFavorite = async (credential: any) => {
    if (!canManageCredential(credential)) return

    const favorite = !credential.favorite

    try {
      await api.put(`/credentials/${credential.id}`, { favorite })
      updateCredential(credential.id, { favorite })

      if (selectedCredential && selectedCredential.id === credential.id) {
        setSelectedCredential({ ...selectedCredential, favorite })
      }
    } catch (favoriteError: any) {
      console.error('更新收藏失败:', favoriteError)
      alert(favoriteError.response?.data?.error || favoriteError.message || '更新收藏失败')
    }
  }

  const handleCardClick = (credential: any) => {
    setSelectedCredential(credential)
    setShowDetail(true)
  }

  const canManageCredential = (credential: any) => {
    return !credential.userId || credential.userId === user?.id
  }

  const pageActions = (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {categoryOptions.map((option) => {
          const Icon = option.icon
          const isActive = effectiveCategory === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveCategory(option.value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-gray-950 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
              }`}
            >
              <Icon size={14} />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
      <div className="relative w-64">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          size={16}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索凭证..."
          className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <button
        onClick={handleCreate}
        className="flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <Plus size={16} />
        <span>新建</span>
      </button>
    </div>
  )

  return (
    <PageShell title={getTitle()} actions={pageActions}>
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-gray-900">{error}</p>
        </div>
      ) : filteredCredentials.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Plus size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || effectiveCategory !== 'all' ? '没有找到匹配的凭证' : '还没有凭证'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || effectiveCategory !== 'all'
              ? '尝试切换分类或使用不同的关键词搜索'
              : '点击"新建"按钮创建您的第一个凭证'}
          </p>
          {!searchQuery && effectiveCategory === 'all' && (
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              创建凭证
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredentials.map((credential) => (
            <CredentialCard
              key={credential.id}
              credential={credential}
              onClick={() => handleCardClick(credential)}
              onEdit={canManageCredential(credential) ? () => handleEdit(credential) : undefined}
              onDelete={canManageCredential(credential) ? () => handleDelete(credential) : undefined}
              onToggleFavorite={
                canManageCredential(credential)
                  ? () => handleToggleFavorite(credential)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* 凭证表单弹窗 */}
      {showForm && (
        <CredentialForm
          mode={editMode ? 'edit' : 'create'}
          initialData={selectedCredential}
          category={category as any}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setSelectedCredential(null)
          }}
        />
      )}

      {/* 凭证详情弹窗 */}
      {showDetail && selectedCredential && (
        <CredentialDetail
          credential={selectedCredential}
          onClose={() => {
            setShowDetail(false)
            setSelectedCredential(null)
          }}
          onEdit={
            canManageCredential(selectedCredential)
              ? () => handleEdit(selectedCredential)
              : undefined
          }
          onDelete={
            canManageCredential(selectedCredential)
              ? () => handleDelete(selectedCredential)
              : undefined
          }
          onToggleFavorite={
            canManageCredential(selectedCredential)
              ? () => handleToggleFavorite(selectedCredential)
              : undefined
          }
        />
      )}
    </PageShell>
  )
}

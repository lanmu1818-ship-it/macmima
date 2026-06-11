import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  Shield,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  Play,
  Users,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Server,
  KeyRound,
} from 'lucide-react'
import { api, getBackendConfig } from '@/services/api'
import { copyToClipboard } from '@/utils/clipboard'
import PageShell from '@/components/layouts/PageShell'

interface InviteCode {
  id: string
  code: string
  createdBy: string
  maxUses: number
  currentUses: number
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  creator?: {
    username: string
    email: string
  }
}

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalInviteCodes: number
  activeInviteCodes: number
}

interface AdminUser {
  id: string
  username: string
  email: string
  isAdmin: boolean
  sharedAccess: boolean
  isActive: boolean
  createdAt: string
  lastLogin: string | null
  invitedBy: string | null
}

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

export default function AdminPage() {
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users')
  const [backendConfig] = useState(() => getBackendConfig())
  const [users, setUsers] = useState<AdminUser[]>([])
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copiedConfigField, setCopiedConfigField] = useState<string | null>(null)
  const [showWorkspaceKey, setShowWorkspaceKey] = useState(false)

  // 创建邀请码表单
  const [maxUses, setMaxUses] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('')

  useEffect(() => {
    if (user?.isAdmin) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, codesRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/invite-codes'),
        api.get('/admin/stats'),
      ])
      setUsers(unwrapResponseData<AdminUser[]>(usersRes))
      setInviteCodes(unwrapResponseData<InviteCode[]>(codesRes))
      setStats(unwrapResponseData<SystemStats>(statsRes))
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = async (targetUser: AdminUser) => {
    const nextStatus = !targetUser.isActive
    const action = nextStatus ? '启用' : '禁用'

    if (!confirm(`确定要${action}用户"${targetUser.username}"吗？`)) return

    try {
      await api.patch(`/admin/users/${targetUser.id}/status`, { isActive: nextStatus })
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || `${action}用户失败`)
    }
  }

  const toggleUserAdmin = async (targetUser: AdminUser) => {
    const nextRole = !targetUser.isAdmin
    const action = nextRole ? '授予管理员权限给' : '撤销管理员权限：'

    if (!confirm(`确定要${action}${targetUser.username}吗？`)) return

    try {
      await api.patch(`/admin/users/${targetUser.id}/admin`, { isAdmin: nextRole })
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || '更新管理员权限失败')
    }
  }

  const toggleUserSharedAccess = async (targetUser: AdminUser) => {
    const nextSharedAccess = !targetUser.sharedAccess
    const action = nextSharedAccess ? '开启' : '关闭'

    if (!confirm(`确定要为用户"${targetUser.username}"${action}共享密区权限吗？`)) return

    try {
      const response = await api.patch(`/admin/users/${targetUser.id}/shared-access`, {
        sharedAccess: nextSharedAccess,
      })
      const updatedUser = unwrapResponseData<AdminUser>(response)

      if (updatedUser.id === user?.id) {
        updateUser({ sharedAccess: updatedUser.sharedAccess })
      }

      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || '更新共享密区权限失败')
    }
  }

  const createInviteCode = async () => {
    try {
      const data: any = { maxUses }
      if (expiresInDays) {
        data.expiresInDays = expiresInDays
      }

      await api.post('/admin/invite-codes', data)
      await loadData()
      setMaxUses(1)
      setExpiresInDays('')
    } catch (error) {
      console.error('创建邀请码失败:', error)
    }
  }

  const copyCode = async (code: string) => {
    const success = await copyToClipboard(code, 0)
    if (success) {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    }
  }

  const copyConfigField = async (field: string, value?: string) => {
    if (!value) return

    const success = await copyToClipboard(value, 0)
    if (success) {
      setCopiedConfigField(field)
      setTimeout(() => setCopiedConfigField(null), 2000)
    }
  }

  const toggleCodeStatus = async (id: string, isActive: boolean) => {
    try {
      const action = isActive ? 'disable' : 'enable'
      await api.patch(`/admin/invite-codes/${id}/${action}`)
      await loadData()
    } catch (error) {
      console.error('切换状态失败:', error)
    }
  }

  const deleteCode = async (id: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) return

    try {
      await api.delete(`/admin/invite-codes/${id}`)
      await loadData()
    } catch (error) {
      console.error('删除邀请码失败:', error)
    }
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">需要管理员权限</h2>
          <p className="text-gray-500">此页面仅管理员可访问</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <PageShell
      title="系统设置"
      description="管理用户、管理员权限和邀请码"
      icon={<Shield className="w-4 h-4 text-primary-600" />}
    >
        {/* 当前工作区配置 */}
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Server className="w-4 h-4" />
                  后端地址
                </div>
                <button
                  onClick={() => copyConfigField('backendUrl', backendConfig?.backendUrl)}
                  disabled={!backendConfig?.backendUrl}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copiedConfigField === 'backendUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedConfigField === 'backendUrl' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700 truncate">
                {backendConfig?.backendUrl || '未配置'}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <KeyRound className="w-4 h-4" />
                  工作区 Key
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowWorkspaceKey((value) => !value)}
                    disabled={!backendConfig?.workspaceKey}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {showWorkspaceKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showWorkspaceKey ? '隐藏' : '查看'}
                  </button>
                  <button
                    onClick={() => copyConfigField('workspaceKey', backendConfig?.workspaceKey)}
                    disabled={!backendConfig?.workspaceKey}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copiedConfigField === 'workspaceKey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedConfigField === 'workspaceKey' ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700 truncate">
                {backendConfig?.workspaceKey
                  ? showWorkspaceKey
                    ? backendConfig.workspaceKey
                    : '•'.repeat(Math.min(backendConfig.workspaceKey.length, 24))
                  : '未配置'}
              </div>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">总用户数</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">启用用户</div>
              <div className="text-3xl font-bold text-gray-900">{stats.activeUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">邀请码总数</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalInviteCodes}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">可用邀请码</div>
              <div className="text-3xl font-bold text-primary-600">{stats.activeInviteCodes}</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invites'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              邀请码
            </button>
          </div>
        </div>

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900">用户管理</h2>
              <button
                onClick={() => setActiveTab('invites')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <UserPlus className="w-4 h-4" />
                创建邀请码
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      权限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      共享密区
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最后登录
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((item) => {
                    const isSelf = item.id === user?.id

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.username}
                              {isSelf && <span className="ml-2 text-xs text-primary-600">当前账号</span>}
                            </div>
                            <div className="text-sm text-gray-500">{item.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              item.isAdmin
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.isAdmin ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {item.isAdmin ? '管理员' : '成员'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              item.sharedAccess
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.sharedAccess ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                            {item.sharedAccess ? '已开启' : '未开启'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              item.isActive
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                            {item.isActive ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.lastLogin
                            ? new Date(item.lastLogin).toLocaleString('zh-CN')
                            : '从未登录'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleUserSharedAccess(item)}
                              className={`p-2 rounded-lg transition-colors ${
                                item.sharedAccess
                                  ? 'text-gray-700 hover:bg-gray-100'
                                  : 'text-gray-900 hover:bg-gray-100'
                              }`}
                              title={item.sharedAccess ? '关闭共享密区' : '开启共享密区'}
                            >
                              {item.sharedAccess ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => toggleUserAdmin(item)}
                              disabled={isSelf && item.isAdmin}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={item.isAdmin ? '撤销管理员' : '设为管理员'}
                            >
                              {item.isAdmin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => toggleUserStatus(item)}
                              disabled={isSelf}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                item.isActive
                                  ? 'text-gray-700 hover:bg-gray-100'
                                  : 'text-gray-900 hover:bg-gray-100'
                              }`}
                              title={item.isActive ? '禁用用户' : '启用用户'}
                            >
                              {item.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">还没有用户</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <>
            {/* 创建邀请码 */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <UserPlus className="w-6 h-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">创建邀请码</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最大使用次数
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    有效期（天）
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="永久有效"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={createInviteCode}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    生成邀请码
                  </button>
                </div>
              </div>
            </div>

            {/* 邀请码列表 */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">邀请码列表</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    邀请码
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    使用情况
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    有效期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inviteCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedCode === code.code ? (
                            <Check className="w-4 h-4 text-gray-900" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {code.currentUses} / {code.maxUses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString('zh-CN')
                        : '永久'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          code.isActive
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {code.isActive ? '活跃' : '已禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(code.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleCodeStatus(code.id, code.isActive)}
                          className={`p-2 rounded-lg transition-colors ${
                            code.isActive
                              ? 'text-gray-700 hover:bg-gray-100'
                              : 'text-gray-900 hover:bg-gray-100'
                          }`}
                          title={code.isActive ? '禁用' : '启用'}
                        >
                          {code.isActive ? <Ban className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteCode(code.id)}
                          className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>

                {inviteCodes.length === 0 && (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">还没有邀请码</p>
                    <p className="text-sm text-gray-400 mt-1">创建第一个邀请码来邀请用户</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
    </PageShell>
  )
}

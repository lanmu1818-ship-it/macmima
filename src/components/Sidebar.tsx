import { useNavigate, useLocation } from 'react-router-dom'
import { MessageSquare, Settings, LogOut, Shield, UserRound, UsersRound } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const displayName = user?.displayName?.trim() || user?.username || ''

  const menuItems = [
    ...(user?.sharedAccess ? [{ path: '/shared', icon: UsersRound, label: '共享密区' }] : []),
    { path: '/credentials', icon: UserRound, label: '个人密区' },
    { path: '/discussion', icon: MessageSquare, label: '开发讨论' },
    { path: '/settings', icon: Settings, label: '个人设置' },
    ...(user?.isAdmin ? [{ path: '/admin', icon: Shield, label: '系统设置' }] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
      {/* 用户信息 */}
      {user && (
        <div className="px-3 pb-3 pt-10 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center shadow-md overflow-hidden">
              {user.avatarDataUrl ? (
                <img
                  src={user.avatarDataUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                {user.isAdmin && (
                  <span className="px-1 py-0.5 bg-gray-900 text-white text-[10px] rounded font-medium">
                    管理员
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 菜单 */}
      <nav className="flex-1 p-3 pt-5">
        <ul className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-black text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  } text-[13px]`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 登出按钮 */}
      <div className="px-3 py-2.5">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-black rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>登出</span>
        </button>
      </div>
    </div>
  )
}

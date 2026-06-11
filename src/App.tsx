import { HashRouter as Router, useLocation } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import CredentialsPage from './pages/CredentialsPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import BackendSetupPage from './pages/BackendSetupPage'
import MainLayout from './components/layouts/MainLayout'
import LocalApiBridge from './components/LocalApiBridge'
import { hasBackendConfig } from './services/api'
import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'

function AppContent() {
  const { isAuthenticated, user, refreshCurrentUser } = useAuthStore()
  const location = useLocation()
  const [isBackendConfigured, setIsBackendConfigured] = useState(hasBackendConfig())

  useEffect(() => {
    if (!isAuthenticated) return

    refreshCurrentUser().catch((error) => {
      console.warn('刷新用户权限失败:', error)
    })
  }, [isAuthenticated, refreshCurrentUser])

  if (!isBackendConfigured) {
    return <BackendSetupPage onConfigured={() => setIsBackendConfigured(true)} />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (location.pathname === '/settings') {
    return (
      <MainLayout>
        <LocalApiBridge />
        <SettingsPage />
      </MainLayout>
    )
  }

  if (location.pathname === '/admin' && user?.isAdmin) {
    return (
      <MainLayout>
        <LocalApiBridge />
        <AdminPage />
      </MainLayout>
    )
  }

  if (location.pathname === '/shared') {
    return (
      <MainLayout>
        <LocalApiBridge />
        {user?.sharedAccess ? (
          <CredentialsPage filter="shared" />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <UsersRound className="w-14 h-14 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800">未开通共享密区权限</h2>
              <p className="text-gray-500 mt-2">请联系管理员在用户管理中开启</p>
            </div>
          </div>
        )}
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <LocalApiBridge />
      <CredentialsPage filter="personal" />
    </MainLayout>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App

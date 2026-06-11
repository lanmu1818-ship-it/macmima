import { ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../Sidebar'
import { useAuthStore } from '@/stores/authStore'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const { lock } = useAuthStore()

  useEffect(() => {
    const handleLock = () => {
      lock()
      navigate('/login', { replace: true })
    }

    window.electronAPI?.onLock(handleLock)

    return () => {
      window.electronAPI?.removeAllListeners('app:lock')
    }
  }, [lock, navigate])

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}

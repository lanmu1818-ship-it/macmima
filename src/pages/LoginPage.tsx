import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, User, Key, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register: registerUser } = useAuthStore()

  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    inviteCode: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
    color: 'bg-gray-400',
  })

  const getPasswordStrength = (password: string) => {
    let score = 0
    let feedback = '太弱'
    let color = 'bg-gray-400'

    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z\d]/.test(password)) score++

    if (score >= 4) {
      feedback = '强'
      color = 'bg-gray-900'
    } else if (score >= 3) {
      feedback = '中等'
      color = 'bg-gray-700'
    } else if (score >= 2) {
      feedback = '一般'
      color = 'bg-gray-500'
    }

    return { score, feedback, color }
  }

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password })
    if (!isLogin) {
      setPasswordStrength(getPasswordStrength(password))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(formData.username, formData.password)
        navigate('/credentials')
      } else {
        if (formData.password.length < 8) {
          setError('密码长度至少8位')
          return
        }

        await registerUser(
          formData.username,
          formData.email,
          formData.password,
          formData.inviteCode
        )
        navigate('/credentials')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-200">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg bg-black">
            <img src="./icon.png" alt="MacMima" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-950">MacMima</h1>
          <p className="text-gray-500 mt-2">安全的密码管理器</p>
        </div>

        {/* 切换登录/注册 */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            onClick={() => {
              setIsLogin(true)
              setError('')
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              isLogin
                ? 'bg-black text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => {
              setIsLogin(false)
              setError('')
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              !isLogin
                ? 'bg-black text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="输入用户名"
                required
              />
            </div>
          </div>

          {/* 邮箱（仅注册） */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="输入邮箱"
                  required
                />
              </div>
            </div>
          )}

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              主密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="输入主密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* 密码强度（仅注册） */}
            {!isLogin && formData.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">密码强度</span>
                  <span className="font-medium">{passwordStrength.feedback}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 邀请码（仅注册） */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邀请码
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.inviteCode}
                  onChange={(e) =>
                    setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })
                  }
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
                  placeholder="输入邀请码"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                首个工作区初始化无需邀请码；已有管理员后，请使用管理员创建的邀请码
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? '登录' : '注册'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* 安全提示 */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-800">
            <strong>⚠️ 重要提示：</strong> 主密码用于加密您的所有数据，请务必牢记。
            一旦忘记，将无法恢复您的数据！
          </p>
        </div>
      </div>
    </div>
  )
}

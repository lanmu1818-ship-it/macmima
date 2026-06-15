import { create } from 'zustand'
import { api } from '@/services/api'
import { deriveKey, hashPassword, generateSalt } from '@/utils/crypto'

interface User {
  id: string
  username: string
  email: string
  displayName?: string | null
  avatarDataUrl?: string | null
  salt: string
  isAdmin?: boolean
  sharedAccess?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  masterKey: CryptoKey | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<string>
  register: (username: string, email: string, password: string, inviteCode?: string) => Promise<void>
  logout: () => void
  lock: () => void
  updateUser: (updates: Partial<User>) => void
  refreshCurrentUser: () => Promise<void>
  setMasterKey: (key: CryptoKey) => void
}

interface AuthPayload {
  token: string
  refreshToken: string
  user: User
}

function unwrapAuthPayload(responseData: any): AuthPayload {
  return responseData?.data || responseData
}

function unwrapData<T>(responseData: any): T {
  return responseData?.data || responseData
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  masterKey: null,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    try {
      const saltResponse = await api.post('/auth/salt', { username })
      const { salt } = unwrapData<{ salt: string }>(saltResponse.data)
      const passwordHash = await hashPassword(password, salt)

      const response = await api.post('/auth/login', {
        username,
        passwordHash,
      })

      const { token, refreshToken, user } = unwrapAuthPayload(response.data)
      const userWithSalt = { ...user, salt: user.salt || salt }

      // 使用返回的salt派生主密钥
      const masterKey = await deriveKey(password, userWithSalt.salt)

      // 保存认证信息
      set({
        user: userWithSalt,
        token,
        masterKey,
        isAuthenticated: true,
      })

      // 设置API默认token
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // 保存token到localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)

      return userWithSalt.salt
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  },

  register: async (username: string, email: string, password: string, inviteCode?: string) => {
    try {
      // 生成盐值
      const salt = generateSalt()

      // 派生主密钥（用于加密数据）
      const masterKey = await deriveKey(password, salt)

      // 生成密码哈希（用于服务器验证）
      const passwordHash = await hashPassword(password, salt)

      const data: any = {
        username,
        email,
        passwordHash,
        salt,
      }

      // 如果提供了邀请码，添加到请求中
      if (inviteCode) {
        data.inviteCode = inviteCode
      }

      const response = await api.post('/auth/register', data)

      const { token, refreshToken, user } = unwrapAuthPayload(response.data)
      const userWithSalt = { ...user, salt: user.salt || salt }

      // 保存认证信息
      set({
        user: userWithSalt,
        token,
        masterKey,
        isAuthenticated: true,
      })

      // 设置API默认token
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // 保存token到localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
    } catch (error) {
      console.error('注册失败:', error)
      throw error
    }
  },

  logout: () => {
    set({
      user: null,
      token: null,
      masterKey: null,
      isAuthenticated: false,
    })

    // 清除localStorage
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')

    // 清除API默认token
    delete api.defaults.headers.common['Authorization']
  },

  lock: () => {
    set({
      masterKey: null,
      isAuthenticated: false,
    })
  },

  updateUser: (updates) => {
    const currentUser = get().user
    if (!currentUser) return

    set({ user: { ...currentUser, ...updates } })
  },

  refreshCurrentUser: async () => {
    const currentUser = get().user
    const token = localStorage.getItem('token')
    if (!currentUser || !token) return

    const response = await api.get('/auth/me')
    const { user } = unwrapData<{ user: User }>(response.data)

    set({
      user: {
        ...currentUser,
        ...user,
        salt: user.salt || currentUser.salt,
      },
    })
  },

  setMasterKey: (key: CryptoKey) => {
    set({ masterKey: key, isAuthenticated: true })
  },
}))

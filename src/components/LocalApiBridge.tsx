import { useEffect } from 'react'
import { api, getBackendConfig } from '@/services/api'
import { Credential, useCredentialStore } from '@/stores/credentialStore'
import { useAuthStore } from '@/stores/authStore'
import { deriveWorkspaceSharedKey, encryptCredentialData } from '@/utils/crypto'
import { getOrCreateCryptoProfile } from '@/services/cryptoProfile'

interface ApiCredential {
  id: string
  userId: string
  scope?: Credential['scope']
  category: Credential['category']
  title: string
  tags: string[] | null
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastUsed?: string | null
}

interface LocalApiCredentialPayload {
  category: Credential['category']
  scope?: Credential['scope']
  title: string
  tags?: string[]
  data?: Record<string, any>
}

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

function normalizeLocalApiPayload(payload: LocalApiCredentialPayload): LocalApiCredentialPayload {
  const allowedCategories: Credential['category'][] = [
    'server',
    'website',
    'api_key',
    'database',
    'document',
    'other',
  ]
  const category = allowedCategories.includes(payload.category) ? payload.category : 'other'
  const title = String(payload.title || '').trim() || '本地 API 导入'

  return {
    category,
    title,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    data: payload.data && typeof payload.data === 'object' ? payload.data : {},
    scope: payload.scope === 'shared' ? 'shared' : 'personal',
  }
}

export default function LocalApiBridge() {
  const { isAuthenticated, masterKey } = useAuthStore()
  const addCredential = useCredentialStore((state) => state.addCredential)

  useEffect(() => {
    const electronApi = window.electronAPI
    if (!electronApi?.onLocalApiCredential || !electronApi.sendLocalApiCredentialResult) return

    return electronApi.onLocalApiCredential(async ({ requestId, payload }) => {
      if (!isAuthenticated || !masterKey) {
        electronApi.sendLocalApiCredentialResult({
          requestId,
          ok: false,
          status: 423,
          error: 'MacMima 未解锁',
        })
        return
      }

      try {
        const normalizedPayload = normalizeLocalApiPayload(payload)
        const cryptoProfile = await getOrCreateCryptoProfile()
        const encrypted = await encryptCredentialData(JSON.stringify(normalizedPayload.data), {
          scope: normalizedPayload.scope || 'personal',
          personalKey: masterKey,
          sharedLegacyKey:
            normalizedPayload.scope === 'shared'
              ? await deriveWorkspaceSharedKey(getBackendConfig()?.workspaceKey || '')
              : null,
          cryptoProfile,
        })
        const response = await api.post('/credentials', {
          category: normalizedPayload.category,
          scope: normalizedPayload.scope,
          title: normalizedPayload.title,
          encryptedData: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          tags: normalizedPayload.tags || [],
        })
        const saved = unwrapResponseData<ApiCredential>(response)
        const credential: Credential = {
          id: saved.id,
          userId: saved.userId,
          scope: saved.scope || normalizedPayload.scope || 'personal',
          category: saved.category,
          title: saved.title,
          data: normalizedPayload.data || {},
          tags: Array.isArray(saved.tags) ? saved.tags : normalizedPayload.tags || [],
          favorite: saved.favorite,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          lastUsed: saved.lastUsed || undefined,
        }

        addCredential(credential)
        electronApi.sendLocalApiCredentialResult({
          requestId,
          ok: true,
          status: 201,
          credential: {
            id: credential.id,
            title: credential.title,
            category: credential.category,
          },
        })
      } catch (error: any) {
        electronApi.sendLocalApiCredentialResult({
          requestId,
          ok: false,
          status: error.response?.status || 500,
          error: error.response?.data?.error || error.message || '保存失败',
        })
      }
    })
  }, [addCredential, isAuthenticated, masterKey])

  return null
}

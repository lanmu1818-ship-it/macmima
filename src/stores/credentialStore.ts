import { create } from 'zustand'

export interface Credential {
  id: string
  userId?: string
  scope: 'personal' | 'shared'
  category: 'server' | 'website' | 'api_key' | 'database' | 'other'
  title: string
  data: Record<string, any>
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastUsed?: string
}

interface CredentialState {
  credentials: Credential[]
  isLoading: boolean
  error: string | null
  setCredentials: (credentials: Credential[]) => void
  addCredential: (credential: Credential) => void
  updateCredential: (id: string, credential: Partial<Credential>) => void
  deleteCredential: (id: string) => void
  toggleFavorite: (id: string) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

export const useCredentialStore = create<CredentialState>((set) => ({
  credentials: [],
  isLoading: false,
  error: null,

  setCredentials: (credentials) => set({ credentials }),

  addCredential: (credential) =>
    set((state) => ({
      credentials: [...state.credentials, credential],
    })),

  updateCredential: (id, updates) =>
    set((state) => ({
      credentials: state.credentials.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  deleteCredential: (id) =>
    set((state) => ({
      credentials: state.credentials.filter((c) => c.id !== id),
    })),

  toggleFavorite: (id) =>
    set((state) => ({
      credentials: state.credentials.map((c) =>
        c.id === id ? { ...c, favorite: !c.favorite } : c
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}))

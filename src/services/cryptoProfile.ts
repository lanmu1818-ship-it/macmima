import type { CryptoProfileConfig } from '@/utils/crypto'

const CRYPTO_PROFILE_KEY = 'macmima-crypto-profile-v2'
const DEFAULT_KDF_ITERATIONS = 210000

export interface StoredCryptoProfile extends CryptoProfileConfig {
  updatedAt?: string
}

export const defaultCryptoProfile: StoredCryptoProfile = {
  enabled: true,
  kdfIterations: DEFAULT_KDF_ITERATIONS,
  localSecret: '',
  sharedVaultSecret: '',
}

function normalizeSecret(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeIterations(value: unknown) {
  const iterations = Number(value)
  if (!Number.isFinite(iterations)) return DEFAULT_KDF_ITERATIONS
  return Math.min(Math.max(Math.round(iterations), 100000), 1000000)
}

function normalizeCryptoProfile(value: Partial<StoredCryptoProfile> | null): StoredCryptoProfile {
  return {
    enabled: value?.enabled !== false,
    kdfIterations: normalizeIterations(value?.kdfIterations),
    localSecret: normalizeSecret(value?.localSecret),
    sharedVaultSecret: normalizeSecret(value?.sharedVaultSecret),
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : undefined,
  }
}

function saveCryptoProfileToLocal(profile: StoredCryptoProfile) {
  localStorage.setItem(CRYPTO_PROFILE_KEY, JSON.stringify(profile))
}

function loadCryptoProfileFromLocal(): StoredCryptoProfile {
  const raw = localStorage.getItem(CRYPTO_PROFILE_KEY)
  if (!raw) return defaultCryptoProfile

  try {
    return normalizeCryptoProfile(JSON.parse(raw))
  } catch {
    return defaultCryptoProfile
  }
}

export function generateCryptoSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function loadCryptoProfile(): Promise<StoredCryptoProfile> {
  if (window.electronAPI?.getCryptoProfile) {
    const profile = await window.electronAPI.getCryptoProfile()
    return normalizeCryptoProfile(profile)
  }

  return loadCryptoProfileFromLocal()
}

export async function saveCryptoProfile(
  nextProfile: Partial<StoredCryptoProfile>
): Promise<StoredCryptoProfile> {
  const currentProfile = await loadCryptoProfile()
  const normalizedProfile = normalizeCryptoProfile({
    ...currentProfile,
    ...nextProfile,
    updatedAt: new Date().toISOString(),
  })

  if (window.electronAPI?.setCryptoProfile) {
    return normalizeCryptoProfile(await window.electronAPI.setCryptoProfile(normalizedProfile))
  }

  saveCryptoProfileToLocal(normalizedProfile)
  return normalizedProfile
}

export async function getOrCreateCryptoProfile(): Promise<StoredCryptoProfile> {
  const profile = await loadCryptoProfile()
  if (!profile.enabled || profile.localSecret) return profile

  return saveCryptoProfile({
    ...profile,
    localSecret: generateCryptoSecret(),
  })
}

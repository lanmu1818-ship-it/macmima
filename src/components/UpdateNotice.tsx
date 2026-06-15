import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type Platform = 'macos' | 'windows'

interface ReleaseItem {
  id: string
  platform: Platform
  arch: string
  version: string
  filename: string
  size: number
  sha256: string
  downloadUrl: string
  notes?: string
  active: boolean
}

interface ReleaseManifest {
  releases: ReleaseItem[]
}

const RELEASES_URL = 'https://macmima.flnxi.com/website-api/releases'
const DISMISSED_UPDATE_KEY = 'macmima-dismissed-update'

function detectPlatform(rawPlatform?: string): Platform | null {
  const platform = (rawPlatform || navigator.platform || '').toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('darwin') || platform.includes('mac') || userAgent.includes('mac os')) {
    return 'macos'
  }

  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows'
  }

  return null
}

function versionParts(version: string) {
  return version
    .replace(/^v/i, '')
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part))
}

function compareVersions(left: string, right: string) {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

async function fetchReleaseManifest() {
  if (window.electronAPI?.getLatestRelease) {
    return window.electronAPI.getLatestRelease()
  }

  const response = await fetch(RELEASES_URL)
  if (!response.ok) throw new Error(`检查更新失败: ${response.status}`)
  return response.json() as Promise<ReleaseManifest>
}

async function openDownload(url: string) {
  if (window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function UpdateNotice() {
  const [release, setRelease] = useState<ReleaseItem | null>(null)
  const [currentVersion, setCurrentVersion] = useState('')

  useEffect(() => {
    let cancelled = false

    const checkForUpdates = async () => {
      try {
        const [version, platformValue, manifest] = await Promise.all([
          window.electronAPI?.getVersion?.() || Promise.resolve('1.0.0'),
          window.electronAPI?.getPlatform?.() || Promise.resolve(''),
          fetchReleaseManifest(),
        ])
        const platform = detectPlatform(platformValue)

        if (!platform || cancelled) return

        const nextRelease = manifest.releases.find(
          (item) => item.platform === platform && item.active && item.downloadUrl
        )
        if (!nextRelease || compareVersions(nextRelease.version, version) <= 0) return

        const dismissKey = `${platform}:${nextRelease.version}:${nextRelease.id}`
        if (localStorage.getItem(DISMISSED_UPDATE_KEY) === dismissKey) return

        setCurrentVersion(version)
        setRelease(nextRelease)
      } catch (error) {
        console.warn('检查更新失败:', error)
      }
    }

    checkForUpdates()

    return () => {
      cancelled = true
    }
  }, [])

  if (!release) return null

  const dismissKey = `${release.platform}:${release.version}:${release.id}`

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_UPDATE_KEY, dismissKey)
    setRelease(null)
  }

  const handleUpdate = async () => {
    localStorage.setItem(DISMISSED_UPDATE_KEY, dismissKey)
    await openDownload(release.downloadUrl)
    setRelease(null)
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[360px] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white">
          <RefreshCw size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">发现新版本 {release.version}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                当前版本 {currentVersion || '未知'}，可下载最新安装包更新。
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="关闭更新提醒"
            >
              <X size={16} />
            </button>
          </div>
          {release.notes && (
            <p className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-gray-600">
              {release.notes}
            </p>
          )}
          <button
            type="button"
            onClick={handleUpdate}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-gray-950 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Download size={14} />
            立即下载更新
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageSquare, X } from 'lucide-react'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

interface ChatMessage {
  id: string
  userId: string
  content: string
  attachments?: Array<{ type: 'image' }>
  createdAt: string
  isMine?: boolean
  user?: {
    username?: string
    displayName?: string | null
  }
}

interface NoticeState {
  title: string
  body: string
}

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

function makeMessageBody(message: ChatMessage, count: number) {
  if (count > 1) return `开发讨论有 ${count} 条新消息`

  const sender = message.user?.displayName?.trim() || message.user?.username || '成员'
  const content = message.content.replace(/\s+/g, ' ').trim()
  if (!content && message.attachments?.some((attachment) => attachment.type === 'image')) {
    return `${sender}: 发来图片`
  }

  const summary = content.length > 80 ? `${content.slice(0, 80)}...` : content

  return `${sender}: ${summary}`
}

function messageMentionsCurrentUser(
  message: ChatMessage,
  user?: { username?: string; displayName?: string | null } | null
) {
  if (!user || !message.content) return false

  const candidates = [user.displayName?.trim(), user.username?.trim()]
    .filter(Boolean)
    .map((value) => `@${String(value).replace(/\s+/g, '')}`)

  return candidates.some((mention) => message.content.includes(mention))
}

async function isWindowForeground() {
  if (window.electronAPI?.isWindowFocused) {
    return window.electronAPI.isWindowFocused()
  }

  return !document.hidden && document.hasFocus()
}

async function showSystemNotification(title: string, body: string, onClick: () => void) {
  if (window.electronAPI?.showNotification) {
    const shown = await window.electronAPI.showNotification({
      title,
      body,
      route: '/discussion',
    })
    if (shown) return
  }

  if (!('Notification' in window)) return

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') return

  const notification = new Notification(title, {
    body,
    silent: false,
  })

  notification.onclick = () => {
    window.focus()
    onClick()
    notification.close()
  }
}

export default function ChatNotificationBridge() {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const latestCreatedAtRef = useRef('')
  const initializedRef = useRef(false)
  const notifiedIdsRef = useRef(new Set<string>())
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const openDiscussion = () => {
    setNotice(null)
    navigate('/discussion')
  }

  useEffect(() => {
    return window.electronAPI?.onNavigate?.((route) => {
      if (route.startsWith('/')) {
        setNotice(null)
        navigate(route)
      }
    })
  }, [navigate])

  useEffect(() => {
    if (!isAuthenticated) {
      latestCreatedAtRef.current = ''
      initializedRef.current = false
      notifiedIdsRef.current.clear()
      setNotice(null)
      return
    }

    let cancelled = false

    const loadMessages = async () => {
      const params = latestCreatedAtRef.current
        ? { limit: 100, after: latestCreatedAtRef.current }
        : { limit: 1, latest: true }
      const response = await api.get('/chat/messages', { params })
      const payload = unwrapResponseData<{ messages: ChatMessage[] }>(response)
      return payload.messages || []
    }

    const poll = async () => {
      try {
        const messages = await loadMessages()
        if (cancelled || messages.length === 0) {
          initializedRef.current = true
          return
        }

        latestCreatedAtRef.current = messages[messages.length - 1].createdAt

        if (!initializedRef.current) {
          initializedRef.current = true
          return
        }

        const incomingMessages = messages.filter(
          (message) =>
            message.userId !== user?.id &&
            !message.isMine &&
            !notifiedIdsRef.current.has(message.id)
        )

        messages.forEach((message) => notifiedIdsRef.current.add(message.id))
        if (incomingMessages.length === 0) return

        const isForegroundDiscussion =
          location.pathname === '/discussion' && (await isWindowForeground())
        if (isForegroundDiscussion) return

        const latestMessage = incomingMessages[incomingMessages.length - 1]
        const mentioned = incomingMessages.some((message) =>
          messageMentionsCurrentUser(message, user)
        )
        const body = makeMessageBody(latestMessage, incomingMessages.length)
        const nextNotice = {
          title: mentioned ? '有人在开发讨论 @ 你' : '开发讨论有新消息',
          body,
        }

        setNotice(nextNotice)
        window.setTimeout(() => {
          setNotice((current) => (current?.body === body ? null : current))
        }, 7000)

        showSystemNotification(nextNotice.title, body, openDiscussion).catch((error) => {
          console.warn('系统通知失败:', error)
        })
      } catch (error) {
        console.warn('检查开发讨论新消息失败:', error)
      }
    }

    poll()
    const timer = window.setInterval(poll, 15000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAuthenticated, location.pathname, user?.displayName, user?.id, user?.username])

  if (!notice) return null

  return (
    <div className="fixed bottom-24 right-5 z-50 w-[340px] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={openDiscussion}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white"
          aria-label="打开开发讨论"
        >
          <MessageSquare size={16} />
        </button>
        <button type="button" onClick={openDiscussion} className="min-w-0 flex-1 text-left">
          <h3 className="text-sm font-semibold text-gray-950">{notice.title}</h3>
          <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-gray-500">
            {notice.body}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="关闭新消息提醒"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

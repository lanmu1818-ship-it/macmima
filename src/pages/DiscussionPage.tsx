import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  AtSign,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import PageShell from '@/components/layouts/PageShell'
import { api } from '@/services/api'
import { copyToClipboard } from '@/utils/clipboard'
import { useAuthStore } from '@/stores/authStore'

interface ChatMessage {
  id: string
  userId: string
  content: string
  attachments?: ChatAttachment[]
  masked: boolean
  isMine: boolean
  createdAt: string
  updatedAt: string
  user: {
    username: string
    email?: string
    displayName?: string | null
    avatarDataUrl?: string | null
  }
}

interface ChatAttachment {
  id: string
  type: 'image'
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

interface ChatMember {
  id: string
  username: string
  email?: string
  displayName?: string | null
  avatarDataUrl?: string | null
  isAdmin: boolean
  sharedAccess: boolean
  lastLogin?: string | null
  lastSeenAt?: string | null
  online: boolean
  createdAt: string
  messageCount: number
  isMe: boolean
}

const maxImageBytes = 2 * 1024 * 1024
const maxTotalImageBytes = 4 * 1024 * 1024
const maxAttachments = 4
const chatPageSize = 50
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function unwrapResponseData<T>(response: any): T {
  return response.data?.data || response.data
}

function getRequestErrorMessage(error: any, fallback: string) {
  if (error.response?.status === 429) return '请求过于频繁，已放慢刷新，请稍后再试'
  return error.response?.data?.error || error.message || fallback
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(size / 1024))}KB`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function getDateKey(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(key: string) {
  const today = getDateKey(new Date().toISOString())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getDateKey(yesterdayDate.toISOString())

  if (key === today) return '今天'
  if (key === yesterday) return '昨天'

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).format(new Date(`${key}T00:00:00`))
  } catch {
    return key
  }
}

function getMessageDisplayName(message: ChatMessage) {
  return message.user?.displayName?.trim() || message.user?.username || '成员'
}

function getMemberDisplayName(member: ChatMember) {
  return member.displayName?.trim() || member.username || '成员'
}

function getMentionLabel(member: ChatMember) {
  return getMemberDisplayName(member).replace(/\s+/g, '')
}

function renderMessageContent(content: string, isMine: boolean) {
  const parts = content.split(/([@＠][^\s@＠]{1,40})/g)

  return parts.map((part, index) => {
    if ((part.startsWith('@') || part.startsWith('＠')) && part.length > 1) {
      return (
        <span
          key={`${part}-${index}`}
          className={`rounded px-1 py-0.5 font-medium ${
            isMine ? 'bg-white/15 text-white' : 'bg-gray-200 text-gray-950'
          }`}
        >
          {part}
        </span>
      )
    }

    return part
  })
}

function MessageAvatar({ message }: { message: ChatMessage }) {
  const name = getMessageDisplayName(message)
  const avatar = message.user?.avatarDataUrl

  return (
    <div className="mt-5 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-xs font-semibold text-white shadow-sm">
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

function MemberAvatar({ member }: { member: ChatMember }) {
  const name = getMemberDisplayName(member)

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-xs font-semibold text-white">
      {member.avatarDataUrl ? (
        <img src={member.avatarDataUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

export default function DiscussionPage() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<ChatMember[]>([])
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(() => new Set())
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [previewImage, setPreviewImage] = useState<ChatAttachment | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagePaneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSendingRef = useRef(false)
  const skipNextAutoScrollRef = useRef(false)

  const latestCreatedAt = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1].createdAt : ''
  }, [messages])

  const earliestCreatedAt = useMemo(() => {
    return messages.length > 0 ? messages[0].createdAt : ''
  }, [messages])

  const messageGroups = useMemo(() => {
    const groupMap = new Map<string, ChatMessage[]>()

    messages.forEach((message) => {
      const key = getDateKey(message.createdAt)
      const group = groupMap.get(key) || []
      group.push(message)
      groupMap.set(key, group)
    })

    return Array.from(groupMap.entries()).map(([key, groupMessages]) => ({
      key,
      label: formatDateLabel(key),
      messages: groupMessages,
    }))
  }, [messages])

  const onlineMembers = useMemo(() => {
    return members.filter((member) => member.online)
  }, [members])

  const mentionableMembers = useMemo(() => {
    return members
      .filter((member) => !member.isMe)
      .sort((left, right) => Number(right.online) - Number(left.online))
  }, [members])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()

    return mentionableMembers
      .filter((member) => {
        const name = getMentionLabel(member).toLowerCase()
        const username = member.username.toLowerCase()
        return !query || name.includes(query) || username.includes(query)
      })
      .slice(0, 8)
  }, [mentionQuery, mentionableMembers])

  const mergeMessages = (nextMessages: ChatMessage[]) => {
    setMessages((current) => {
      const map = new Map(current.map((message) => [message.id, message]))
      nextMessages.forEach((message) => map.set(message.id, message))
      return Array.from(map.values()).sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      )
    })
  }

  const loadMessages = async (options: {
    after?: string
    before?: string
    initial?: boolean
    older?: boolean
  } = {}) => {
    const { after, before, initial, older } = options
    const response = await api.get('/chat/messages', {
      params: {
        limit: after ? 100 : chatPageSize,
        ...(after ? { after } : {}),
        ...(before ? { before } : {}),
        ...(!after && !before ? { latest: true } : {}),
      },
    })
    const payload = unwrapResponseData<{
      messages: ChatMessage[]
      pageInfo?: { hasMoreOlder?: boolean }
    }>(response)

    if (initial) {
      setMessages([])
    }

    mergeMessages(payload.messages || [])

    if (!after) {
      setHasMoreOlder(Boolean(payload.pageInfo?.hasMoreOlder))
    }

    if (older && (payload.messages || []).length === 0) {
      setHasMoreOlder(false)
    }
  }

  const loadMembers = async () => {
    const response = await api.get('/chat/members')
    const payload = unwrapResponseData<{ members: ChatMember[] }>(response)
    setMembers(payload.members || [])
  }

  const updateMentionQuery = (value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition)
    const match = beforeCursor.match(/(?:^|\s)[@＠]([^\s@＠]{0,40})$/)

    setMentionQuery(match ? match[1] : null)
    setSelectedMentionIndex(0)
  }

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value.replace(/＠/g, '@')
    setContent(nextValue)
    updateMentionQuery(nextValue, event.target.selectionStart)
  }

  const insertMention = (member: ChatMember) => {
    const textarea = textareaRef.current
    const mention = `@${getMentionLabel(member)} `

    if (!textarea) {
      setContent((current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}${mention}`)
      setMentionQuery(null)
      return
    }

    const cursor = textarea.selectionStart
    const beforeCursor = content.slice(0, cursor)
    const afterCursor = content.slice(textarea.selectionEnd)
    const match = beforeCursor.match(/(?:^|\s)[@＠]([^\s@＠]{0,40})$/)
    const replaceStart = match ? beforeCursor.length - match[1].length - 1 : cursor
    const prefix = match ? content.slice(0, replaceStart) : `${beforeCursor}${beforeCursor.endsWith(' ') || !beforeCursor ? '' : ' '}`
    const nextValue = `${prefix}${mention}${afterCursor}`
    const nextCursor = `${prefix}${mention}`.length

    setContent(nextValue)
    setMentionQuery(null)
    setIsMemberMenuOpen(false)

    window.setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    }, 0)
  }

  useEffect(() => {
    let cancelled = false

    const loadInitialMessages = async () => {
      try {
        setIsLoading(true)
        setError('')
        await Promise.all([loadMessages({ initial: true }), loadMembers()])
      } catch (loadError: any) {
        if (!cancelled) {
          setError(getRequestErrorMessage(loadError, '加载讨论失败'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadInitialMessages()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadMessages({ after: latestCreatedAt }).catch((pollError) => {
        console.warn('刷新讨论失败:', pollError)
      })
    }, 8000)

    return () => window.clearInterval(timer)
  }, [latestCreatedAt])

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadMembers().catch((membersError) => {
        console.warn('刷新讨论成员失败:', membersError)
      })
    }, 30000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false
      return
    }

    scrollRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  useEffect(() => {
    if (selectedMentionIndex >= mentionSuggestions.length) {
      setSelectedMentionIndex(0)
    }
  }, [mentionSuggestions.length, selectedMentionIndex])

  const handleSend = async () => {
    const text = content.trim()
    if ((!text && pendingAttachments.length === 0) || isSendingRef.current) return

    const attachmentsToSend = pendingAttachments
    const now = new Date().toISOString()
    const optimisticId = `pending-${crypto.randomUUID()}`
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      userId: user?.id || 'me',
      content: text,
      attachments: attachmentsToSend,
      masked: false,
      isMine: true,
      createdAt: now,
      updatedAt: now,
      user: {
        username: user?.username || '我',
        email: user?.email,
        displayName: user?.displayName,
        avatarDataUrl: user?.avatarDataUrl,
      },
    }

    try {
      isSendingRef.current = true
      setIsSending(true)
      setError('')
      mergeMessages([optimisticMessage])
      setContent('')
      setPendingAttachments([])
      setMentionQuery(null)

      const response = await api.post('/chat/messages', {
        content: text,
        attachments: attachmentsToSend,
      })
      const payload = unwrapResponseData<{ message: ChatMessage }>(response)
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      if (payload.message) {
        mergeMessages([payload.message])
      }
      loadMembers().catch((membersError) => {
        console.warn('刷新讨论成员失败:', membersError)
      })
    } catch (sendError: any) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      setContent((current) => current || text)
      setPendingAttachments((current) => (current.length > 0 ? current : attachmentsToSend))
      setError(getRequestErrorMessage(sendError, '发送失败'))
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const handleImageFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const availableSlots = maxAttachments - pendingAttachments.length
    if (availableSlots <= 0) {
      setError(`单条消息最多发送 ${maxAttachments} 张图片`)
      return
    }

    try {
      const nextAttachments: ChatAttachment[] = []
      let totalSize =
        pendingAttachments.reduce((sum, attachment) => sum + attachment.size, 0)

      for (const file of imageFiles.slice(0, availableSlots)) {
        if (!allowedImageTypes.has(file.type)) {
          setError('仅支持 PNG、JPG、WebP 或 GIF 图片')
          continue
        }

        if (file.size > maxImageBytes) {
          setError('单张图片不能超过 2MB')
          continue
        }

        if (totalSize + file.size > maxTotalImageBytes) {
          setError('单条消息图片总大小不能超过 4MB')
          continue
        }

        totalSize += file.size
        nextAttachments.push({
          id: crypto.randomUUID(),
          type: 'image',
          name: file.name || 'pasted-image',
          mimeType: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        })
      }

      if (nextAttachments.length > 0) {
        setPendingAttachments((current) => [...current, ...nextAttachments])
        setError('')
      }
    } catch (imageError: any) {
      setError(imageError.message || '读取图片失败')
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (files.length === 0) return

    event.preventDefault()
    handleImageFiles(files)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (files.length === 0) return

    event.preventDefault()
    handleImageFiles(files)
  }

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((current) => current.filter((item) => item.id !== id))
  }

  const handleCopy = async (message: ChatMessage) => {
    const ok = await copyToClipboard(message.content, 0)
    if (ok) {
      setCopiedId(message.id)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  const handleDelete = async (message: ChatMessage) => {
    if (!message.isMine && !user?.isAdmin) return
    if (!confirm('确定删除这条消息吗？')) return

    try {
      await api.delete(`/chat/messages/${message.id}`)
      setMessages((current) => current.filter((item) => item.id !== message.id))
    } catch (deleteError: any) {
      setError(getRequestErrorMessage(deleteError, '删除失败'))
    }
  }

  const handleLoadOlder = async () => {
    if (!earliestCreatedAt || isLoadingOlder || !hasMoreOlder) return

    const pane = messagePaneRef.current
    const previousScrollHeight = pane?.scrollHeight || 0

    try {
      skipNextAutoScrollRef.current = true
      setIsLoadingOlder(true)
      setError('')
      await loadMessages({ before: earliestCreatedAt, older: true })

      window.requestAnimationFrame(() => {
        if (!pane) return
        pane.scrollTop += pane.scrollHeight - previousScrollHeight
      })
    } catch (loadError: any) {
      setError(getRequestErrorMessage(loadError, '加载更早记录失败'))
    } finally {
      setIsLoadingOlder(false)
    }
  }

  const toggleDateCollapsed = (dateKey: string) => {
    setCollapsedDates((current) => {
      const next = new Set(current)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedMentionIndex((current) => (current + 1) % mentionSuggestions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedMentionIndex(
          (current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length
        )
        return
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insertMention(mentionSuggestions[selectedMentionIndex] || mentionSuggestions[0])
        return
      }

      if (event.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }

    const isComposing = (event.nativeEvent as KeyboardEvent).isComposing

    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault()
      handleSend()
    }
  }

  const renderMessage = (message: ChatMessage) => (
    <div
      key={message.id}
      className={`flex items-start gap-2 ${message.isMine ? 'justify-end' : 'justify-start'}`}
    >
      {!message.isMine && <MessageAvatar message={message} />}
      <div
        className={`group max-w-[74%] rounded-lg border px-3 py-2 ${
          message.isMine
            ? 'border-gray-950 bg-gray-950 text-white'
            : 'border-gray-200 bg-gray-50 text-gray-900'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span
            className={`text-[11px] font-medium ${
              message.isMine ? 'text-gray-300' : 'text-gray-500'
            }`}
          >
            {getMessageDisplayName(message)} · {formatTime(message.createdAt)}
            {message.masked ? ' · 已脱敏' : ''}
          </span>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => handleCopy(message)}
              className={`rounded p-1 ${
                message.isMine
                  ? 'hover:bg-white/10 text-gray-300'
                  : 'hover:bg-gray-200 text-gray-500'
              }`}
              aria-label="复制消息"
            >
              {copiedId === message.id ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {(message.isMine || user?.isAdmin) && (
              <button
                type="button"
                onClick={() => handleDelete(message)}
                className={`rounded p-1 ${
                  message.isMine
                    ? 'hover:bg-white/10 text-gray-300'
                    : 'hover:bg-gray-200 text-gray-500'
                }`}
                aria-label="删除消息"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        {message.content && (
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {renderMessageContent(message.content, message.isMine)}
          </p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`mt-2 grid gap-2 ${message.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {message.attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setPreviewImage(attachment)}
                className="overflow-hidden rounded-lg border border-white/20 bg-white/10"
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="max-h-56 w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      {message.isMine && <MessageAvatar message={message} />}
    </div>
  )

  return (
    <PageShell title="开发讨论" contentClassName="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-950">开发讨论</h1>
          <p className="mt-1 text-xs text-gray-500">
            同一工作区成员可见，发送前会自动脱敏不合规词语。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMemberMenuOpen((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              <UsersRound size={14} />
              在线 {onlineMembers.length}/{members.length}
              <ChevronDown size={13} className={isMemberMenuOpen ? 'rotate-180' : ''} />
            </button>

            {isMemberMenuOpen && (
              <div className="absolute right-0 top-11 z-30 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-950">在线用户</span>
                  <span className="text-[11px] text-gray-400">点击插入 @</span>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {onlineMembers.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-400">
                      暂无在线用户
                    </div>
                  ) : (
                    onlineMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => insertMention(member)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100"
                      >
                        <MemberAvatar member={member} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-medium text-gray-950">
                              {getMemberDisplayName(member)}
                            </p>
                            {member.isMe && (
                              <span className="rounded bg-gray-900 px-1 py-0.5 text-[10px] text-white">
                                我
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-gray-500">@{getMentionLabel(member)}</p>
                        </div>
                        <AtSign size={13} className="text-gray-400" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
            <MessageSquare size={14} />
            工作区频道
          </div>
        </div>
      </div>

      <div
        ref={messagePaneRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <MessageSquare size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">还没有讨论内容</p>
            <p className="mt-1 text-xs text-gray-500">发一条需求、接口说明或协作问题。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hasMoreOlder && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlder}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingOlder ? '加载中...' : '加载更早记录'}
                </button>
              </div>
            )}

            {messageGroups.map((group) => {
              const collapsed = collapsedDates.has(group.key)

              return (
                <section key={group.key} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleDateCollapsed(group.key)}
                    className="mx-auto flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
                    />
                    <span>{group.label}</span>
                    <span>{group.messages.length} 条</span>
                  </button>

                  {!collapsed && (
                    <div className="space-y-3">
                      {group.messages.map((message) => renderMessage(message))}
                    </div>
                  )}
                </section>
              )
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          {error}
        </div>
      )}

      <div
        className="mt-4 rounded-lg border border-gray-200 bg-white p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {pendingAttachments.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingAttachment(attachment.id)}
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="移除图片"
                >
                  <X size={13} />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-[10px] text-white">
                  <p className="truncate">{attachment.name}</p>
                  <p className="opacity-75">{formatFileSize(attachment.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          {mentionQuery !== null && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
              <div className="border-b border-gray-100 px-3 py-2 text-[11px] font-medium text-gray-500">
                选择好友
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {mentionSuggestions.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-400">
                    没有匹配的好友
                  </div>
                ) : (
                  mentionSuggestions.map((member, index) => (
                    <button
                      key={member.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        insertMention(member)
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${
                        index === selectedMentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <MemberAvatar member={member} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-950">
                          {getMemberDisplayName(member)}
                        </p>
                        <p className="truncate text-[10px] text-gray-500">
                          @{getMentionLabel(member)} · {member.online ? '在线' : '离线'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onClick={(event) => updateMentionQuery(content, event.currentTarget.selectionStart)}
            className="min-h-[78px] w-full resize-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900 outline-none focus:border-gray-300 focus:bg-white"
            placeholder="输入讨论内容，Enter 发送，Shift+Enter 换行。输入 @ 可选择好友。"
            maxLength={4000}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) handleImageFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              <ImageIcon size={14} />
              图片
            </button>
            <span className="text-[11px] text-gray-400">
              {content.length}/4000 · {pendingAttachments.length}/{maxAttachments} 张
            </span>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={(!content.trim() && pendingAttachments.length === 0) || isSending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-950 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={14} />
            {isSending ? '发送中' : '发送'}
          </button>
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-gray-700 shadow-lg"
              aria-label="关闭图片预览"
            >
              <X size={18} />
            </button>
            <img
              src={previewImage.dataUrl}
              alt={previewImage.name}
              className="max-h-[82vh] max-w-full rounded-lg bg-white object-contain"
            />
          </div>
        </div>
      )}
    </PageShell>
  )
}

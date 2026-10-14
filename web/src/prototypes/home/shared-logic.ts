import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type RefObject, type CSSProperties } from 'react'
import { CHATS, MESSAGES, ME_ID, PEOPLE, type Chat, type Msg, type Person } from './demo-data'

export const DESKTOP_QUERY = '(min-width: 768px)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY)

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const shortDayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

export const formatTime = (ts: number) => timeFmt.format(ts)

function dayDiff(ts: number): number {
  const a = new Date(ts)
  a.setHours(0, 0, 0, 0)
  const b = new Date()
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function dayLabel(ts: number): string {
  const diff = dayDiff(ts)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return dayFmt.format(ts)
}

export function listTime(ts: number): string {
  const diff = dayDiff(ts)
  if (diff === 0) return formatTime(ts)
  if (diff === 1) return 'Вчера'
  return shortDayFmt.format(ts)
}

export function daysUntil(iso: string): number {
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

export type TimelineItem = { msg: Msg; mine: boolean; first: boolean; last: boolean }
export type Day = { key: string; label: string; items: TimelineItem[] }

const GROUP_GAP_MS = 7 * 60_000

export function buildDays(messages: Msg[]): Day[] {
  const days: Day[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const key = new Date(msg.ts).toDateString()
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(msg.ts), items: [] }
      days.push(day)
    }
    const joinsPrev =
      !!prev && prev.authorId === msg.authorId && new Date(prev.ts).toDateString() === key && msg.ts - prev.ts < GROUP_GAP_MS
    const joinsNext =
      !!next && next.authorId === msg.authorId && new Date(next.ts).toDateString() === key && next.ts - msg.ts < GROUP_GAP_MS
    day.items.push({ msg, mine: msg.authorId === ME_ID, first: !joinsPrev, last: !joinsNext })
  })
  return days
}

export const personOf = (id: string): Person => PEOPLE[id]

export function previewOf(msg: Msg | undefined): string {
  if (!msg) return ''
  return msg.voice ? 'Голосовое сообщение' : msg.text
}

export type ChatRow = { chat: Chat; last: Msg | undefined }

export function useMessenger() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const preselect = window.matchMedia(DESKTOP_QUERY).matches ? CHATS[0].id : null
    return CHATS.map((c) => (c.id === preselect ? { ...c, unread: 0, newQuestion: false } : c))
  })
  const [messages, setMessages] = useState<Msg[]>(MESSAGES)
  const [shownId, setShownId] = useState<string | null>(() => (window.matchMedia(DESKTOP_QUERY).matches ? CHATS[0].id : null))
  const [isOpen, setIsOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const counter = useRef(0)
  const live = useRef({ shownId, isOpen })
  useLayoutEffect(() => {
    live.current = { shownId, isOpen }
  })

  const receive = useCallback((chatId: string, authorId: string, text: string) => {
    counter.current += 1
    const msg: Msg = {
      id: `r-${Date.now()}-${counter.current}`,
      chatId,
      authorId,
      text,
      ts: Date.now(),
      reactions: {},
      fresh: true,
    }
    setMessages((prev) => [...prev, msg])
    if (!(live.current.isOpen && live.current.shownId === chatId)) {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread: c.unread + 1 } : c)))
    }
  }, [])

  const open = useCallback((id: string) => {
    setShownId(id)
    setIsOpen(true)
    setReplyToId(null)
    setMenuId(null)
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0, newQuestion: false } : c)))
  }, [])

  const back = useCallback(() => {
    setIsOpen(false)
    setReplyToId(null)
    setMenuId(null)
  }, [])

  const send = useCallback(
    (text: string, extra: Partial<Msg> = {}) => {
      const clean = text.trim()
      if (!shownId || (!clean && !extra.voice)) return
      counter.current += 1
      const msg: Msg = {
        id: `u-${Date.now()}-${counter.current}`,
        chatId: shownId,
        authorId: ME_ID,
        text: clean,
        ts: Date.now(),
        reactions: {},
        fresh: true,
        replyTo: replyToId ?? undefined,
        ...extra,
      }
      setMessages((prev) => [...prev, msg])
      setReplyToId(null)
    },
    [shownId, replyToId],
  )

  const toggleReaction = useCallback((msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId) return msg
        const users = msg.reactions[emoji] ?? []
        const next = users.includes(ME_ID) ? users.filter((u) => u !== ME_ID) : [...users, ME_ID]
        const reactions = { ...msg.reactions }
        if (next.length) reactions[emoji] = next
        else delete reactions[emoji]
        return { ...msg, reactions }
      }),
    )
    setMenuId(null)
  }, [])

  const startReply = useCallback((id: string) => {
    setReplyToId(id)
    setMenuId(null)
  }, [])

  const byId = useMemo(() => new Map(messages.map((msg) => [msg.id, msg])), [messages])

  const rows = useMemo<ChatRow[]>(() => {
    const lastOf = new Map<string, Msg>()
    for (const msg of messages) {
      const cur = lastOf.get(msg.chatId)
      if (!cur || cur.ts < msg.ts) lastOf.set(msg.chatId, msg)
    }
    return chats
      .map((chat) => ({ chat, last: lastOf.get(chat.id) }))
      .sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0))
  }, [chats, messages])

  const q = query.trim().toLowerCase()
  const filteredRows = useMemo(
    () =>
      q
        ? rows.filter(
            ({ chat, last }) =>
              chat.title.toLowerCase().includes(q) ||
              chat.short.toLowerCase().includes(q) ||
              previewOf(last).toLowerCase().includes(q) ||
              (last && PEOPLE[last.authorId].name.toLowerCase().includes(q)),
          )
        : rows,
    [rows, q],
  )

  const chat = shownId ? (chats.find((c) => c.id === shownId) ?? null) : null
  const chatMessages = useMemo(
    () => messages.filter((msg) => msg.chatId === shownId).sort((a, b) => a.ts - b.ts),
    [messages, shownId],
  )
  const days = useMemo(() => buildDays(chatMessages), [chatMessages])

  const answers = useMemo(() => {
    const map = new Map<string, Msg[]>()
    for (const msg of messages) {
      if (!msg.replyTo) continue
      map.set(msg.replyTo, [...(map.get(msg.replyTo) ?? []), msg])
    }
    return map
  }, [messages])

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0)
  const sentCount = messages.filter((msg) => msg.authorId === ME_ID).length

  return {
    chats,
    rows: filteredRows,
    allRows: rows,
    chat,
    isOpen,
    days,
    chatMessages,
    byId,
    answers,
    replyTo: replyToId ? (byId.get(replyToId) ?? null) : null,
    menuId,
    setMenuId,
    query,
    setQuery,
    open,
    back,
    send,
    receive,
    toggleReaction,
    startReply,
    cancelReply: () => setReplyToId(null),
    totalUnread,
    sentCount,
  }
}

export type Messenger = ReturnType<typeof useMessenger>

export function useBubbleGestures(onMenu: () => void, onLike: () => void) {
  const timer = useRef<number | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const lastTap = useRef(0)
  const cb = useRef({ onMenu, onLike })
  useLayoutEffect(() => {
    cb.current = { onMenu, onLike }
  })

  const clear = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }
  useEffect(() => clear, [])

  const interactive = (e: ReactPointerEvent) => !!(e.target as HTMLElement).closest('a, button')

  return {
    onPointerDown(e: ReactPointerEvent) {
      if (interactive(e)) return
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      if (e.pointerType !== 'mouse') {
        clear()
        timer.current = window.setTimeout(() => {
          fired.current = true
          cb.current.onMenu()
        }, 450)
      }
    },
    onPointerMove(e: ReactPointerEvent) {
      const o = origin.current
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 8) {
        clear()
        origin.current = null
        lastTap.current = 0
      }
    },
    onPointerUp(e: ReactPointerEvent) {
      clear()
      if (interactive(e) || !origin.current) return
      origin.current = null
      if (fired.current) {
        fired.current = false
        return
      }
      const now = performance.now()
      if (now - lastTap.current < 320) {
        lastTap.current = 0
        cb.current.onLike()
      } else {
        lastTap.current = now
      }
    },
    onPointerCancel() {
      clear()
      origin.current = null
    },
    onContextMenu(e: { preventDefault: () => void }) {
      e.preventDefault()
      clear()
      cb.current.onMenu()
    },
    onMouseDown(e: { detail: number; preventDefault: () => void }) {
      if (e.detail > 1) e.preventDefault()
    },
  }
}

export function useStickToBottom(ref: RefObject<HTMLElement | null>, chatKey: string | null, count: number, padding = 0) {
  const atBottom = useRef(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
    atBottom.current = true
  }, [ref, chatKey])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [ref, padding])

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [ref, count])
}

export function useFocusOnReply(ref: RefObject<HTMLTextAreaElement | null>, replyId: string | null) {
  useEffect(() => {
    if (replyId) ref.current?.focus()
  }, [ref, replyId])
}

export function scrollToMessage(id: string) {
  document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export const REACTION_SET = ['👍', '❤️', '😂', '🔥', '🙏', '🤔'] as const

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

export const hueStyle = (hue: number) => ({ '--h': hue }) as CSSProperties

export function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [ref])
  return h
}

export function previewLine(chat: Chat, last: Msg | undefined): string {
  if (!last) return ''
  const body = previewOf(last)
  if (last.authorId === ME_ID) return `Вы: ${body}`
  if (chat.kind === 'subject') return `${PEOPLE[last.authorId].name.split(' ')[0]}: ${body}`
  return body
}

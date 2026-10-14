import type { Database, Json } from '@/lib/database.types'

type ChatRow = Database['public']['Functions']['list_my_chats']['Returns'][number]

export type LastMessage = {
  id: string
  body: string | null
  createdAt: string
  deleted: boolean
  senderId: string | null
  senderName: string | null
  attachmentKind: 'image' | 'video' | 'audio' | 'file' | null
}

export type ChatPeer = {
  id: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  course: number | null
}

export type ChatSummary = {
  id: string
  type: 'group' | 'direct'
  name: string | null
  avatarUrl: string | null
  lastMessageAt: string
  lastMessage: LastMessage | null
  unread: number
  role: string
  peer: ChatPeer | null
}

function obj(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)

const ATTACHMENT_KINDS = ['image', 'video', 'audio', 'file'] as const

function parseLastMessage(value: Json): LastMessage | null {
  const o = obj(value)
  if (!o || typeof o.id !== 'string') return null
  const kind = ATTACHMENT_KINDS.find((k) => k === o.attachment_kind) ?? null
  return {
    id: o.id,
    body: str(o.body),
    createdAt: str(o.created_at) ?? '',
    deleted: str(o.deleted_at) !== null,
    senderId: str(o.sender_id),
    senderName: str(o.sender_display_name),
    attachmentKind: kind,
  }
}

export function parsePeer(value: Json): ChatPeer | null {
  const o = obj(value)
  if (!o || typeof o.id !== 'string') return null
  return {
    id: o.id,
    username: str(o.username),
    displayName: str(o.display_name) ?? '',
    avatarUrl: str(o.avatar_url),
    course: typeof o.course === 'number' ? o.course : null,
  }
}

export function parseChat(row: ChatRow): ChatSummary {
  return {
    id: row.id,
    type: row.type === 'direct' ? 'direct' : 'group',
    name: row.name,
    avatarUrl: row.avatar_url,
    lastMessageAt: row.last_message_at,
    lastMessage: parseLastMessage(row.last_message),
    unread: Number(row.unread_count) || 0,
    role: row.role,
    peer: parsePeer(row.peer),
  }
}

export function peerName(peer: ChatPeer | null) {
  if (!peer) return ''
  return peer.displayName || (peer.username ? `@${peer.username}` : '')
}

/** Название для списка и шапки: у группы — name, у личного чата — имя собеседника. */
export function chatTitle(chat: Pick<ChatSummary, 'type' | 'name' | 'peer'>) {
  return (chat.type === 'direct' ? peerName(chat.peer) : chat.name) ?? ''
}

/** Поиск без учёта регистра (в том числе казахские буквы: Ә Ғ Қ Ң Ө Ұ Ү Һ І). */
export function matchesQuery(chat: ChatSummary, query: string) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase()
  if (!q) return true
  const fields = [chatTitle(chat), chat.peer?.username ?? '']
  return fields.some((f) => f.normalize('NFC').toLocaleLowerCase().includes(q))
}

const DAY = 86_400_000

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Сегодня — ЧЧ:ММ, вчера — «Вчера», в пределах недели — день недели, иначе дата. */
export function formatChatTime(iso: string, lang: string, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY)
  if (days <= 0) return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
  if (days === 1) {
    const s = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-1, 'day')
    return s.charAt(0).toLocaleUpperCase(lang) + s.slice(1)
  }
  if (days < 7) return new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(d)
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}

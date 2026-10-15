export type MessageStatus = 'sent' | 'sending' | 'failed'
export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

export type MessageAuthor = {
  id: string
  displayName: string
  username: string | null
  course: number | null
  avatarUrl: string | null
}

export type MessageAttachment = {
  id: string
  kind: AttachmentKind
  mime: string
  sizeBytes: number
  storagePath: string
  width: number | null
  height: number | null
  durationMs: number | null
}

export type MessageReaction = { emoji: string; count: number; mine: boolean }

export type ReplyPreview = { id: string; authorName: string; body: string | null; deleted: boolean }

export type ChatMessage = {
  id: string
  chatId: string
  senderId: string | null
  author: MessageAuthor | null
  body: string | null
  /** Строка из БД как есть (микросекунды) — нужна для курсора. */
  createdAt: string
  deleted: boolean
  replyTo: string | null
  reply: ReplyPreview | null
  attachments: MessageAttachment[]
  reactions: MessageReaction[]
  status: MessageStatus
}

export type MessageCursor = { createdAt: string; id: string }

const ATTACHMENT_KINDS: readonly AttachmentKind[] = ['image', 'video', 'audio', 'file']

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const num = (v: unknown) => (typeof v === 'number' ? v : null)

function parseAuthor(raw: unknown): MessageAuthor | null {
  const o = rec(raw)
  const id = o && str(o.id)
  if (!o || !id) return null
  return {
    id,
    displayName: str(o.display_name) ?? '',
    username: str(o.username),
    course: num(o.course),
    avatarUrl: str(o.avatar_url),
  }
}

function parseAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: MessageAttachment[] = []
  for (const item of raw) {
    const o = rec(item)
    const id = o && str(o.id)
    const kind = ATTACHMENT_KINDS.find((k) => k === o?.kind)
    if (!o || !id || !kind) continue
    out.push({
      id,
      kind,
      mime: str(o.mime) ?? '',
      sizeBytes: num(o.size_bytes) ?? 0,
      storagePath: str(o.storage_path) ?? '',
      width: num(o.width),
      height: num(o.height),
      durationMs: num(o.duration_ms),
    })
  }
  return out
}

/** Реакции приходят двумя способами: строками таблицы (emoji, user_id) из select и готовыми счётчиками (emoji, count, user_ids) из RPC. */
export function parseReactions(raw: unknown, myId: string | undefined): MessageReaction[] {
  if (!Array.isArray(raw)) return []
  const byEmoji = new Map<string, { count: number; mine: boolean }>()
  for (const item of raw) {
    const o = rec(item)
    const emoji = o && str(o.emoji)
    if (!o || !emoji) continue
    const cur = byEmoji.get(emoji) ?? { count: 0, mine: false }
    if (Array.isArray(o.user_ids)) {
      cur.count += num(o.count) ?? o.user_ids.length
      cur.mine ||= myId !== undefined && o.user_ids.includes(myId)
    } else {
      cur.count += 1
      cur.mine ||= myId !== undefined && o.user_id === myId
    }
    byEmoji.set(emoji, cur)
  }
  return [...byEmoji]
    .filter(([, v]) => v.count > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
}

function parseReply(raw: unknown): ReplyPreview | null {
  const o = rec(raw)
  const id = o && str(o.id)
  if (!o || !id) return null
  const sender = rec(o.sender)
  return {
    id,
    authorName: str(o.sender_display_name) ?? (sender ? str(sender.display_name) : null) ?? '',
    body: str(o.body),
    deleted: str(o.deleted_at) !== null,
  }
}

/** Сообщение из строки select (с вложенными sender/attachments/reactions/reply) или из ответа RPC send_message. */
export function parseMessage(raw: unknown, myId: string | undefined): ChatMessage | null {
  const o = rec(raw)
  const id = o && str(o.id)
  const chatId = o && str(o.chat_id)
  const createdAt = o && str(o.created_at)
  if (!o || !id || !chatId || !createdAt) return null
  const author = parseAuthor(o.sender)
  return {
    id,
    chatId,
    senderId: str(o.sender_id) ?? author?.id ?? null,
    author,
    body: str(o.body),
    createdAt,
    deleted: str(o.deleted_at) !== null,
    replyTo: str(o.reply_to),
    reply: parseReply(o.reply),
    attachments: parseAttachments(o.attachments),
    reactions: parseReactions(o.reactions, myId),
    status: 'sent',
  }
}

export function cursorOf(m: ChatMessage): MessageCursor {
  return { createdAt: m.createdAt, id: m.id }
}

/** Порядок по возрастанию: время, затем id (как в индексе и курсоре). */
export function compareMessages(a: ChatMessage, b: ChatMessage) {
  const d = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// ---------- Группировка и дни ----------

export const GROUP_GAP_MS = 5 * 60_000

export type FeedRow = { msg: ChatMessage; mine: boolean; first: boolean; last: boolean }
export type FeedDay = { key: string; ts: number; rows: FeedRow[] }

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Сообщения по возрастанию → дни, в них строки с признаками «первое/последнее в группе». */
export function buildDays(messages: readonly ChatMessage[], myId: string | undefined): FeedDay[] {
  const days: FeedDay[] = []
  let prev: ChatMessage | null = null
  for (const msg of messages) {
    const ts = Date.parse(msg.createdAt)
    const key = dayKey(ts)
    let day = days.at(-1)
    if (!day || day.key !== key) {
      day = { key, ts, rows: [] }
      days.push(day)
    }
    const prevRow = day.rows.at(-1)
    const joins =
      !!prev &&
      !!prevRow &&
      msg.senderId !== null &&
      prev.senderId === msg.senderId &&
      ts - Date.parse(prev.createdAt) <= GROUP_GAP_MS
    if (joins && prevRow) prevRow.last = false
    day.rows.push({ msg, mine: msg.senderId === myId, first: !joins, last: true })
    prev = msg
  }
  return days
}

// ---------- Даты ----------

const DAY_MS = 86_400_000
const timeFormats = new Map<string, Intl.DateTimeFormat>()

export function formatMessageTime(iso: string, lang: string) {
  let f = timeFormats.get(lang)
  if (!f) {
    f = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    timeFormats.set(lang, f)
  }
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : f.format(t)
}

const cap = (s: string, lang: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1)

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** «Сегодня», «Вчера», день недели (до недели назад), иначе дата; всё через Intl на языке интерфейса. */
export function formatDayLabel(ts: number, lang: string, now = new Date()) {
  const d = new Date(ts)
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS)
  if (days <= 1) return cap(new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-Math.max(days, 0), 'day'), lang)
  if (days < 7) return cap(new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(d), lang)
  const sameYear = d.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d)
}

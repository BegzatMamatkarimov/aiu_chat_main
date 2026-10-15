import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { applyDeletedMessage, applyIncomingMessage } from '@/features/chats/chat-list-cache'
import { markChatRead } from '@/features/chats/mark-read'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { setRealtimeHealthy } from '@/features/messages/connection-status'
import { parseMessage, parseReactions } from '@/features/messages/message-model'
import { applyServerReactions } from '@/features/messages/reactions'
import { markMessageDeleted, syncLatest, upsertMessage } from '@/features/messages/use-chat-messages'

/**
 * Лимит одновременных каналов на пользователя (в Supabase на проект ~200 соединений, это защита от гигантских списков).
 * Если чатов больше, подписываемся на самые свежие по last_message_at; остальные обновятся при refetch списка.
 */
export const MAX_CHANNELS = 90

const BACKOFF_BASE_MS = 2000
const BACKOFF_MAX_MS = 30_000
const MEMBERS_BACKOFF_MAX_MS = 60_000
const RESYNC_DEBOUNCE_MS = 300

type ChatEntry = { ch: RealtimeChannel; ok: boolean; tries: number; timer?: number }

export type RealtimeManager = {
  /** Нужный набор чатов (уже ограниченный MAX_CHANNELS); каналы добавляются и снимаются под него. */
  setChats: (ids: readonly string[]) => void
  stop: () => void
}

export type RealtimeOptions = {
  qc: QueryClient
  myId: string
  getToken: () => string | undefined
  getOpenChatId: () => string | undefined
}

// Общая очередь операций: канал с тем же топиком нельзя создавать, пока старый не снят (StrictMode, пересоздание).
let tail: Promise<unknown> = Promise.resolve()
function enqueue(fn: () => Promise<void> | void) {
  tail = tail.then(fn).catch(() => {})
}

async function drop(ch: RealtimeChannel) {
  try {
    await supabase.removeChannel(ch)
  } catch {
    /* канал уже закрыт */
  }
}

const backoff = (tries: number, max: number) => Math.min(max, BACKOFF_BASE_MS * 2 ** tries) * (0.75 + Math.random() * 0.5)

export function startRealtime({ qc, myId, getToken, getOpenChatId }: RealtimeOptions): RealtimeManager {
  let stopped = false
  let wanted: readonly string[] = []
  const entries = new Map<string, ChatEntry>()
  let members: { ch: RealtimeChannel; tries: number } | null = null
  let membersTimer: number | undefined
  let resyncTimer: number | undefined

  const report = () => {
    const all = [...entries.values()]
    setRealtimeHealthy(all.length === 0 || all.some((e) => e.ok))
  }

  /** Догрузка пропущенного: открытый чат и список чатов. */
  const resync = () => {
    window.clearTimeout(resyncTimer)
    resyncTimer = window.setTimeout(() => {
      if (stopped) return
      const open = getOpenChatId()
      if (open) syncLatest(qc, open, myId).catch(() => {})
      void qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true })
    }, RESYNC_DEBOUNCE_MS)
  }

  const viewing = (chatId: string) => getOpenChatId() === chatId && document.visibilityState === 'visible'

  const onNew = (payload: unknown) => {
    const msg = parseMessage(payload, myId)
    if (!msg) return
    // Своё сообщение с этого устройства уже есть в pending под тем же id: серверная версия в кэше заменяет его без дубля.
    upsertMessage(qc, msg)
    const seen = viewing(msg.chatId)
    applyIncomingMessage(qc, msg, myId, seen)
    if (seen && msg.senderId !== myId) markChatRead(qc, msg.chatId)
  }

  const onDeleted = (chatId: string, payload: unknown) => {
    const id = payload && typeof payload === 'object' ? (payload as { id?: unknown }).id : null
    if (typeof id !== 'string') return
    markMessageDeleted(qc, chatId, id)
    applyDeletedMessage(qc, chatId, id)
  }

  // reactions_payload отдаёт user_ids по каждому эмодзи, поэтому «моя» считается по ним, как и при загрузке ленты.
  const onReaction = (chatId: string, payload: unknown) => {
    const o = payload && typeof payload === 'object' ? (payload as { message_id?: unknown; reactions?: unknown }) : null
    if (!o || typeof o.message_id !== 'string') return
    applyServerReactions(qc, chatId, o.message_id, parseReactions(o.reactions, myId))
  }

  const arm = (chatId: string, entry: ChatEntry) => {
    window.clearTimeout(entry.timer)
    const delay = backoff(entry.tries, BACKOFF_MAX_MS)
    entry.tries += 1
    entry.timer = window.setTimeout(() => {
      if (stopped || entries.get(chatId) !== entry || entry.ok) return
      // Пока сокет сам переподключается, канал не трогаем; если сокет жив, а канал нет — пересоздаём.
      if (supabase.realtime.isConnected()) enqueue(() => recreate(chatId))
      else arm(chatId, entry)
    }, delay)
  }

  const subscribeChat = (chatId: string, tries = 0) => {
    if (stopped || entries.has(chatId)) return
    const ch = supabase.channel(`chat:${chatId}`, { config: { private: true } })
    const entry: ChatEntry = { ch, ok: false, tries }
    entries.set(chatId, entry)
    ch.on('broadcast', { event: 'message_new' }, (m) => onNew(m.payload))
      .on('broadcast', { event: 'message_deleted' }, (m) => onDeleted(chatId, m.payload))
      .on('broadcast', { event: 'reaction_changed' }, (m) => onReaction(chatId, m.payload))
      .subscribe((status) => {
        if (stopped || entries.get(chatId) !== entry) return
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(entry.timer)
          entry.ok = true
          entry.tries = 0
          // Между загрузкой ленты/списка и подключением канала сообщение могло прийти мимо нас: догружаем всегда.
          resync()
        } else {
          entry.ok = false
          arm(chatId, entry)
        }
        report()
      })
    report()
  }

  const unsubscribeChat = async (chatId: string) => {
    const entry = entries.get(chatId)
    if (!entry) return
    entries.delete(chatId)
    window.clearTimeout(entry.timer)
    await drop(entry.ch)
    report()
  }

  async function recreate(chatId: string) {
    const entry = entries.get(chatId)
    if (stopped || !entry || entry.ok || !wanted.includes(chatId)) return
    const tries = entry.tries
    await unsubscribeChat(chatId)
    subscribeChat(chatId, tries)
  }

  const reconcile = async () => {
    if (stopped) return
    for (const id of [...entries.keys()]) if (!wanted.includes(id)) await unsubscribeChat(id)
    for (const id of wanted) subscribeChat(id)
  }

  // Появление чата (кто-то создал личный чат с нами, вступление с другого устройства) → перезагрузка списка → новый канал.
  // Нужна публикация supabase_realtime для chat_members (миграция 20261017000100); без неё канал повторяет попытки редко.
  const subscribeMembers = (tries = 0) => {
    if (stopped || members) return
    const ch = supabase.channel(`members:${myId}`)
    const cur = { ch, tries }
    members = cur
    let trouble = false
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${myId}` },
      () => void qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true }),
    ).subscribe((status) => {
      if (stopped || members !== cur) return
      if (status === 'SUBSCRIBED') {
        cur.tries = 0
        if (trouble) {
          trouble = false
          void qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true })
        }
        return
      }
      trouble = true
      members = null
      const next = cur.tries + 1
      membersTimer = window.setTimeout(
        () =>
          enqueue(async () => {
            await drop(ch)
            subscribeMembers(next)
          }),
        backoff(cur.tries, MEMBERS_BACKOFF_MAX_MS),
      )
    })
  }

  /** Вкладка снова видна или вернулась сеть: догрузить пропущенное и подтолкнуть упавшие каналы. */
  const wake = () => {
    if (stopped) return
    if (!supabase.realtime.isConnected()) supabase.realtime.connect()
    for (const [id, entry] of entries) {
      if (!entry.ok && supabase.realtime.isConnected()) enqueue(() => recreate(id))
    }
    resync()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') wake()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', wake)

  enqueue(async () => {
    if (stopped) return
    try {
      await supabase.realtime.setAuth(getToken() ?? null)
    } catch {
      /* токен подхватится при следующем обновлении сессии */
    }
    subscribeMembers()
    await reconcile()
  })

  return {
    setChats(ids) {
      wanted = ids.slice(0, MAX_CHANNELS)
      enqueue(reconcile)
    },
    stop() {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', wake)
      window.clearTimeout(resyncTimer)
      for (const e of entries.values()) window.clearTimeout(e.timer)
      const chans = [...entries.values()].map((e) => e.ch)
      entries.clear()
      const m = members
      members = null
      window.clearTimeout(membersTimer)
      setRealtimeHealthy(true)
      enqueue(async () => {
        for (const ch of chans) await drop(ch)
        if (m) await drop(m.ch)
      })
    },
  }
}

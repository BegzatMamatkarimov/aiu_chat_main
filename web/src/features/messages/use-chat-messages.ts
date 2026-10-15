import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  compareMessages,
  cursorOf,
  parseMessage,
  type ChatMessage,
  type MessageCursor,
} from '@/features/messages/message-model'
import { usePendingMessages } from '@/features/messages/pending-messages'

export const PAGE_SIZE = 50
export const messagesKey = (chatId: string) => ['messages', chatId] as const

/** Страница ленты: сообщения от новых к старым; next — курсор следующей (более старой) страницы. */
export type MessagesPage = { items: ChatMessage[]; next: MessageCursor | null }
type MessagesCache = InfiniteData<MessagesPage, MessageCursor | null>

const SELECT = `id, chat_id, sender_id, body, reply_to, created_at, deleted_at,
  sender:profiles!messages_sender_id_fkey(id, display_name, username, course, avatar_url),
  attachments(id, kind, storage_path, mime, size_bytes, width, height, duration_ms),
  reactions(emoji, user_id),
  reply:reply_to(id, body, deleted_at, sender:profiles!messages_sender_id_fkey(display_name))`

async function fetchPage(chatId: string, cursor: MessageCursor | null, myId: string | undefined): Promise<MessagesPage> {
  let q = supabase
    .from('messages')
    .select(SELECT)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
  const { data, error } = await q
  if (error) throw error
  const items: ChatMessage[] = []
  for (const row of data as unknown as unknown[]) {
    const m = parseMessage(row, myId)
    if (m) items.push(m)
  }
  const last = items.at(-1)
  return { items, next: items.length === PAGE_SIZE && last ? cursorOf(last) : null }
}

/** Вклеивает свежую первую страницу в кэш, не трогая подгруженные старые. Если пропуск больше страницы — оставляем только свежую. */
function mergeLatest(old: MessagesCache | undefined, fresh: MessagesPage): MessagesCache {
  const reset: MessagesCache = { pages: [fresh], pageParams: [null] }
  const head = old?.pages[0]
  if (!old || !head || fresh.next === null) return reset
  const index = new Map(head.items.map((m, i) => [m.id, i]))
  for (let j = fresh.items.length - 1; j >= 0; j--) {
    const at = index.get(fresh.items[j].id)
    if (at === undefined) continue
    const items = [...fresh.items.slice(0, j + 1), ...head.items.slice(at + 1)]
    return { ...old, pages: [{ items, next: head.next }, ...old.pages.slice(1)] }
  }
  return reset
}

/** Догружает новое с сервера (фокус окна, повторное открытие чата). Realtime (5.3) будет пользоваться теми же функциями кэша. */
export async function syncLatest(qc: QueryClient, chatId: string, myId: string | undefined) {
  if (!qc.getQueryData(messagesKey(chatId))) return
  const fresh = await fetchPage(chatId, null, myId)
  qc.setQueryData<MessagesCache>(messagesKey(chatId), (old) => mergeLatest(old, fresh))
}

/** Добавляет или заменяет сообщение в кэше ленты (серверная версия после отправки). */
export function upsertMessage(qc: QueryClient, msg: ChatMessage) {
  qc.setQueryData<MessagesCache>(messagesKey(msg.chatId), (old) => {
    if (!old) return old
    for (let p = 0; p < old.pages.length; p++) {
      const at = old.pages[p].items.findIndex((m) => m.id === msg.id)
      if (at === -1) continue
      const items = old.pages[p].items.slice()
      items[at] = msg
      const pages = old.pages.slice()
      pages[p] = { ...old.pages[p], items }
      return { ...old, pages }
    }
    const head = old.pages[0]
    if (!head) return old
    const items = head.items.slice()
    const at = items.findIndex((m) => compareMessages(m, msg) < 0)
    items.splice(at === -1 ? items.length : at, 0, msg)
    return { ...old, pages: [{ ...head, items }, ...old.pages.slice(1)] }
  })
}

/** Плоский список по возрастанию: серверные сообщения + ещё не подтверждённые (без дублей, серверная версия главнее). */
function flatten(data: { pages: MessagesPage[] } | undefined, pending: readonly ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>()
  const desc: ChatMessage[] = []
  for (const page of data?.pages ?? []) {
    for (const m of page.items) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      desc.push(m)
    }
  }
  const list = desc.reverse()
  for (const p of pending) if (!seen.has(p.id)) list.push(p)
  return list
}

export function useChatMessages(chatId: string, myId: string | undefined) {
  const qc = useQueryClient()
  const pending = usePendingMessages(chatId)
  const query = useInfiniteQuery({
    queryKey: messagesKey(chatId),
    initialPageParam: null as MessageCursor | null,
    queryFn: ({ pageParam }) => fetchPage(chatId, pageParam, myId),
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  // Новое с сервера: при повторном открытии чата из кэша и при возвращении в окно.
  useEffect(() => {
    let lastRun = 0
    const run = () => {
      const now = Date.now()
      if (now - lastRun < 1500) return
      lastRun = now
      syncLatest(qc, chatId, myId).catch(() => {})
    }
    if (qc.getQueryState(messagesKey(chatId))?.status === 'success') run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [qc, chatId, myId])

  const messages = useMemo(() => flatten(query.data, pending), [query.data, pending])
  return {
    messages,
    loaded: query.data !== undefined,
    isPending: query.isPending,
    isError: query.isError && query.data === undefined,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: query.fetchNextPage,
  }
}

/** Загружена ли лента чата (отправлять можно только в загруженную: серверное сообщение вставляется в её кэш). */
export function useFeedLoaded(chatId: string) {
  const qc = useQueryClient()
  return useSyncExternalStore(
    (cb) => qc.getQueryCache().subscribe(cb),
    () => qc.getQueryState(messagesKey(chatId))?.data !== undefined,
  )
}

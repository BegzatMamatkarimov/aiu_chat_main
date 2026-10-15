import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ChatSummary } from '@/features/chats/chat-model'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'

const THROTTLE_MS = 2000

/** Чаты, которые сейчас открыты и готовы к отметке «прочитано» (лента и исходный счётчик уже получены). */
const active = new Set<string>()
const state = new Map<string, { last: number; timer?: number }>()

export function setReadActive(chatId: string, on: boolean) {
  if (on) active.add(chatId)
  else active.delete(chatId)
}

/** Чат прямо сейчас читается: вкладка видна, значит любой ответ списка с ненулевым счётчиком для него устарел. */
export const isReading = (chatId: string) => active.has(chatId) && document.visibilityState === 'visible'

/** После ответа сервера подтягиваем список заново: ответы, начатые до mark_read, могли принести старый счётчик. */
function send(qc: QueryClient, chatId: string) {
  void supabase
    .rpc('mark_read', { p_chat_id: chatId })
    .then(
      () => qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true }),
      () => {},
    )
}

/** Отмечает чат прочитанным: счётчик в списке обнуляется сразу, запрос — не чаще раза в 2 с на чат, последний вызов не теряется. */
export function markChatRead(qc: QueryClient, chatId: string) {
  if (!active.has(chatId) || document.visibilityState !== 'visible') return
  qc.setQueryData<ChatSummary[]>(MY_CHATS_KEY, (old) =>
    old?.some((c) => c.id === chatId && c.unread > 0) ? old.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) : old,
  )
  const s = state.get(chatId) ?? { last: 0 }
  state.set(chatId, s)
  if (s.timer !== undefined) return
  const wait = s.last + THROTTLE_MS - Date.now()
  if (wait <= 0) {
    s.last = Date.now()
    send(qc, chatId)
    return
  }
  s.timer = window.setTimeout(() => {
    s.timer = undefined
    s.last = Date.now()
    send(qc, chatId)
  }, wait)
}

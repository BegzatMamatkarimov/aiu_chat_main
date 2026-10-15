import { useSyncExternalStore } from 'react'
import type { ChatMessage } from '@/features/messages/message-model'

const EMPTY: readonly ChatMessage[] = []
const byChat = new Map<string, readonly ChatMessage[]>()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Неотправленные и отправляемые сообщения чата. Живут в памяти отдельно от кэша запроса, чтобы refetch их не стирал. */
export function usePendingMessages(chatId: string): readonly ChatMessage[] {
  return useSyncExternalStore(subscribe, () => byChat.get(chatId) ?? EMPTY)
}

export function getPendingMessage(chatId: string, id: string) {
  return byChat.get(chatId)?.find((m) => m.id === id)
}

export function addPending(msg: ChatMessage) {
  byChat.set(msg.chatId, [...(byChat.get(msg.chatId) ?? EMPTY), msg])
  emit()
}

export function patchPending(chatId: string, id: string, patch: Partial<ChatMessage>) {
  const list = byChat.get(chatId)
  if (!list?.some((m) => m.id === id)) return
  byChat.set(chatId, list.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  emit()
}

export function removePending(chatId: string, id: string) {
  const list = byChat.get(chatId)
  if (!list?.some((m) => m.id === id)) return
  const next = list.filter((m) => m.id !== id)
  if (next.length) byChat.set(chatId, next)
  else byChat.delete(chatId)
  emit()
}

export function clearPending() {
  byChat.clear()
  emit()
}

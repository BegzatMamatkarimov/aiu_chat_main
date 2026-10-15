import { useSyncExternalStore } from 'react'
import type { ReplyPreview } from '@/features/messages/message-model'

const byChat = new Map<string, ReplyPreview>()
const inputs = new Map<string, HTMLTextAreaElement>()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Сообщение, на которое сейчас готовится ответ в чате (цитата над полем ввода). Живёт в памяти. */
export function useReplyTarget(chatId: string): ReplyPreview | null {
  return useSyncExternalStore(subscribe, () => byChat.get(chatId) ?? null)
}

export function getReplyTarget(chatId: string) {
  return byChat.get(chatId) ?? null
}

export function setReplyTarget(chatId: string, target: ReplyPreview) {
  byChat.set(chatId, target)
  emit()
}

export function clearReply(chatId: string) {
  if (byChat.delete(chatId)) emit()
}

/** Сообщение, на которое готовится ответ, удалили: цитата показывает «Сообщение удалено». */
export function markReplyDeleted(chatId: string, id: string) {
  const cur = byChat.get(chatId)
  if (!cur || cur.id !== id || cur.deleted) return
  byChat.set(chatId, { ...cur, deleted: true, body: null })
  emit()
}

export function registerComposer(chatId: string, el: HTMLTextAreaElement | null) {
  if (el) inputs.set(chatId, el)
  else inputs.delete(chatId)
}

/** Вызывать прямо из обработчика жеста/клика: на iOS клавиатура открывается только так. */
export function focusComposer(chatId: string) {
  inputs.get(chatId)?.focus({ preventScroll: true })
}

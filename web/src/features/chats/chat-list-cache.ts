import type { QueryClient } from '@tanstack/react-query'
import type { ChatSummary } from '@/features/chats/chat-model'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import type { ChatMessage } from '@/features/messages/message-model'

const byRecent = (a: ChatSummary, b: ChatSummary) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)

/**
 * Новое сообщение из realtime в кэше списка чатов, без refetch: превью, время, порядок, счётчик.
 * Счётчик растёт только для чужого сообщения в чате, который сейчас не открыт и не виден.
 * Неизвестный чат (ещё нет в списке) — просим список перезагрузиться.
 */
export function applyIncomingMessage(qc: QueryClient, msg: ChatMessage, myId: string, viewing: boolean) {
  const list = qc.getQueryData<ChatSummary[]>(MY_CHATS_KEY)
  if (!list) return
  if (!list.some((c) => c.id === msg.chatId)) {
    void qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true })
    return
  }
  const mine = msg.senderId === myId
  qc.setQueryData<ChatSummary[]>(MY_CHATS_KEY, (old) => {
    if (!old) return old
    const cur = old.find((c) => c.id === msg.chatId)
    if (!cur) return old
    // Уже учтено (своё сообщение после ответа RPC, повтор события) или это более старое сообщение.
    if (cur.lastMessage?.id === msg.id) return old
    if (cur.lastMessage && Date.parse(msg.createdAt) < Date.parse(cur.lastMessage.createdAt)) return old
    const next = old.map((c) =>
      c.id === msg.chatId
        ? {
            ...c,
            lastMessageAt: msg.createdAt,
            unread: c.unread + (mine || viewing ? 0 : 1),
            lastMessage: {
              id: msg.id,
              body: msg.body,
              createdAt: msg.createdAt,
              deleted: false,
              senderId: msg.senderId,
              senderName: msg.author?.displayName ?? null,
              attachmentKind: msg.attachments[0]?.kind ?? null,
            },
          }
        : c,
    )
    return next.sort(byRecent)
  })
}

/** Если удалено последнее сообщение — превью становится «Сообщение удалено». */
export function applyDeletedMessage(qc: QueryClient, chatId: string, id: string) {
  qc.setQueryData<ChatSummary[]>(MY_CHATS_KEY, (old) => {
    if (!old) return old
    const cur = old.find((c) => c.id === chatId)
    if (!cur?.lastMessage || cur.lastMessage.id !== id || cur.lastMessage.deleted) return old
    return old.map((c) =>
      c.id === chatId && c.lastMessage
        ? { ...c, lastMessage: { ...c.lastMessage, deleted: true, body: null, attachmentKind: null } }
        : c,
    )
  })
}

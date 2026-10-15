import { useCallback, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'
import type { ChatSummary } from '@/features/chats/chat-model'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { parseMessage, type ChatMessage, type MessageAuthor, type ReplyPreview } from '@/features/messages/message-model'
import { addPending, getPendingMessage, patchPending, removePending } from '@/features/messages/pending-messages'
import { messagesKey, upsertMessage } from '@/features/messages/use-chat-messages'

export const MAX_BODY = 4000

const inflight = new Set<string>()

/** Последнее сообщение и порядок в списке чатов — сразу по ответу сервера, затем сверяемся с сервером. */
function touchChatList(qc: QueryClient, msg: ChatMessage, myId: string, myName: string | null) {
  qc.setQueryData<ChatSummary[]>(MY_CHATS_KEY, (old) => {
    if (!old) return old
    const next = old.map((c) =>
      c.id === msg.chatId
        ? {
            ...c,
            lastMessageAt: msg.createdAt,
            lastMessage: {
              id: msg.id,
              body: msg.body,
              createdAt: msg.createdAt,
              deleted: false,
              senderId: myId,
              senderName: myName,
              attachmentKind: null,
            },
          }
        : c,
    )
    return next.sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
  })
  void qc.invalidateQueries({ queryKey: MY_CHATS_KEY, exact: true })
}

/** Один заход в RPC: одно и то же сообщение не уходит дважды одновременно, а повтор с тем же UUID сервер считает тем же сообщением. */
async function deliver(qc: QueryClient, msg: ChatMessage, myId: string, myName: string | null) {
  if (inflight.has(msg.id)) return
  inflight.add(msg.id)
  patchPending(msg.chatId, msg.id, { status: 'sending' })
  let saved: ChatMessage | null = null
  try {
    const { data, error } = await supabase.rpc('send_message', {
      p_id: msg.id,
      p_chat_id: msg.chatId,
      p_body: msg.body,
      p_reply_to: msg.replyTo,
      p_attachments: [],
    })
    if (!error) saved = parseMessage(data, myId)
  } catch {
    saved = null
  }
  inflight.delete(msg.id)
  if (!saved) {
    patchPending(msg.chatId, msg.id, { status: 'failed' })
    return
  }
  // Серверная версия остаётся в pending, пока не окажется в кэше ленты (его снимает useChatMessages): без мигания и без дублей.
  patchPending(msg.chatId, msg.id, saved)
  if (qc.getQueryData(messagesKey(msg.chatId))) upsertMessage(qc, saved)
  touchChatList(qc, saved, myId, myName)
}

export function useSendMessage(chatId: string) {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  const myId = user?.id
  const name = profile?.display_name || null
  const author = useMemo<MessageAuthor | null>(
    () =>
      profile
        ? { id: profile.id, displayName: profile.display_name, username: profile.username, course: profile.course, avatarUrl: profile.avatar_url }
        : null,
    [profile],
  )

  const send = useCallback(
    (text: string, reply: ReplyPreview | null = null) => {
      const body = text.trim()
      if (!myId || !body || body.length > MAX_BODY) return false
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        chatId,
        senderId: myId,
        author,
        body,
        createdAt: new Date().toISOString(),
        deleted: false,
        replyTo: reply?.id ?? null,
        reply,
        attachments: [],
        reactions: [],
        status: 'sending',
      }
      addPending(msg)
      void deliver(qc, msg, myId, name)
      return true
    },
    [qc, chatId, myId, name, author],
  )

  const retry = useCallback(
    (id: string) => {
      const msg = getPendingMessage(chatId, id)
      if (myId && msg && msg.status === 'failed') void deliver(qc, msg, myId, name)
    },
    [qc, chatId, myId, name],
  )

  const discard = useCallback(
    (id: string) => {
      if (!inflight.has(id)) removePending(chatId, id)
    },
    [chatId],
  )

  return { send, retry, discard }
}

import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'
import { parseReactions, toggleReactionLocal, type MessageReaction } from '@/features/messages/message-model'
import { findCachedMessage, patchMessage, setMessageReactions } from '@/features/messages/use-chat-messages'

/** Пока для сообщения идут мои запросы, события сервера по нему откладываются: иначе чип прыгает туда-обратно. */
const inflight = new Map<string, { n: number; deferred: MessageReaction[] | null }>()

/** Реакции от сервера (realtime): применяются сразу, а если по сообщению идёт мой запрос — после него. */
export function applyServerReactions(qc: QueryClient, chatId: string, id: string, reactions: MessageReaction[]) {
  const st = inflight.get(id)
  if (st) st.deferred = reactions
  else setMessageReactions(qc, chatId, id, reactions)
}

const mineKey = (r: readonly MessageReaction[]) =>
  r
    .filter((x) => x.mine)
    .map((x) => x.emoji)
    .sort()
    .join('|')

export function useToggleReaction(chatId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { user } = useAuth()
  const myId = user?.id

  return useCallback(
    async (id: string, emoji: string) => {
      const msg = findCachedMessage(qc, chatId, id)
      if (!msg || msg.deleted) return
      const st = inflight.get(id) ?? { n: 0, deferred: null }
      st.n += 1
      inflight.set(id, st)
      patchMessage(qc, chatId, id, (m) => ({ ...m, reactions: toggleReactionLocal(m.reactions, emoji) }))

      let server: MessageReaction[] | null = null
      let failed = false
      try {
        const { data, error } = await supabase.rpc('toggle_reaction', { p_message_id: id, p_emoji: emoji })
        if (error) throw error
        const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as { reactions?: unknown }) : null
        if (o && Array.isArray(o.reactions)) server = parseReactions(o.reactions, myId)
      } catch {
        failed = true
      }

      if (failed) {
        // Откат только своего переключения: чужие изменения и другие мои запросы остаются.
        patchMessage(qc, chatId, id, (m) => ({ ...m, reactions: toggleReactionLocal(m.reactions, emoji) }))
        toast.error(t('chat.msgMenu.reactError'))
      }
      st.n -= 1
      if (st.n > 0) return
      inflight.delete(id)
      // Последний запрос завершён: источник истины — сервер. Событие realtime свежее ответа, если уже содержит мои реакции из ответа.
      const deferred = st.deferred
      const next = deferred && (!server || mineKey(deferred) === mineKey(server)) ? deferred : server
      if (next) setMessageReactions(qc, chatId, id, next)
    },
    [qc, chatId, myId, t],
  )
}

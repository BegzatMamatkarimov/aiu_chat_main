import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { applyDeletedMessage } from '@/features/chats/chat-list-cache'
import { findCachedMessage, markMessageDeleted, restoreMessage } from '@/features/messages/use-chat-messages'

/** Удаление: сообщение сразу становится «удалённым», при ошибке возвращается и показывается тост. */
export function useDeleteMessage(chatId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  return useCallback(
    async (id: string) => {
      const snapshot = findCachedMessage(qc, chatId, id)
      if (!snapshot || snapshot.deleted) return
      markMessageDeleted(qc, chatId, id)
      try {
        const { error } = await supabase.rpc('delete_message', { p_id: id })
        if (error) throw error
        applyDeletedMessage(qc, chatId, id)
      } catch {
        restoreMessage(qc, snapshot)
        toast.error(t('chat.delete.error'))
      }
    },
    [qc, chatId, t],
  )
}

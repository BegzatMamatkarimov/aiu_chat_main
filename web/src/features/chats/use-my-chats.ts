import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isReading } from '@/features/chats/mark-read'
import { parseChat, type ChatSummary } from '@/features/chats/chat-model'
import { supabase } from '@/lib/supabase'

export const MY_CHATS_KEY = ['chats', 'mine'] as const

async function fetchMyChats(): Promise<ChatSummary[]> {
  const { data, error } = await supabase.rpc('list_my_chats')
  if (error) throw error
  return data.map(parseChat).map((c) => (c.unread > 0 && isReading(c.id) ? { ...c, unread: 0 } : c))
}

export function useMyChats() {
  return useQuery({ queryKey: MY_CHATS_KEY, queryFn: fetchMyChats, refetchOnWindowFocus: true })
}

/** Приватные группы из моего списка: list_my_chats не отдаёт is_public, поэтому читаем его из chats. Пока не загрузилось — пусто. */
export function usePrivateGroupIds(): ReadonlySet<string> {
  const { data } = useMyChats()
  const ids = (data ?? []).filter((c) => c.type === 'group').map((c) => c.id).sort()
  const q = useQuery({
    queryKey: [...MY_CHATS_KEY, 'visibility', ids.join(',')],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('chats').select('id,is_public').in('id', ids)
      if (error) throw error
      return rows.filter((r) => !r.is_public).map((r) => r.id)
    },
  })
  return useMemo(() => new Set(q.data ?? []), [q.data])
}

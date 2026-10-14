import { useQuery } from '@tanstack/react-query'
import { parseChat, type ChatSummary } from '@/features/chats/chat-model'
import { supabase } from '@/lib/supabase'

export const MY_CHATS_KEY = ['chats', 'mine'] as const

async function fetchMyChats(): Promise<ChatSummary[]> {
  const { data, error } = await supabase.rpc('list_my_chats')
  if (error) throw error
  return data.map(parseChat)
}

export function useMyChats() {
  return useQuery({ queryKey: MY_CHATS_KEY, queryFn: fetchMyChats, refetchOnWindowFocus: true })
}

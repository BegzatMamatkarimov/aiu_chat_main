import { useQuery } from '@tanstack/react-query'
import { parsePeer, chatTitle, type ChatPeer } from '@/features/chats/chat-model'
import { useMyChats } from '@/features/chats/use-my-chats'
import { useAuth } from '@/features/auth/use-auth'
import { supabase } from '@/lib/supabase'

export type ChatHeader = {
  id: string
  type: 'group' | 'direct'
  title: string
  avatarUrl: string | null
  peer: ChatPeer | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Чат, которого нет в кэше списка (прямой заход по ссылке): только если я его участник. */
async function fetchMemberChat(chatId: string, userId: string): Promise<ChatHeader | null> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('chats(id, type, name, avatar_url)')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const chat = data?.chats
  if (!chat) return null
  const type = chat.type === 'direct' ? 'direct' : 'group'
  let peer: ChatPeer | null = null
  if (type === 'direct') {
    const { data: pair, error: pairError } = await supabase
      .from('direct_pairs')
      .select('user_a, user_b')
      .eq('chat_id', chatId)
      .maybeSingle()
    if (pairError) throw pairError
    if (pair) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, course')
        .eq('id', pair.user_a === userId ? pair.user_b : pair.user_a)
        .maybeSingle()
      if (profileError) throw profileError
      peer = profile ? parsePeer(profile) : null
    }
  }
  return { id: chat.id, type, title: chatTitle({ type, name: chat.name, peer }), avatarUrl: type === 'direct' ? (peer?.avatarUrl ?? null) : chat.avatar_url, peer }
}

export type ChatHeaderState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'missing' }
  | { status: 'ready'; chat: ChatHeader }

/** Шапка чата: из кэша списка, а если там нет (после загрузки списка) — отдельным запросом. */
export function useChatHeader(chatId: string): ChatHeaderState {
  const { user } = useAuth()
  const list = useMyChats()
  const valid = UUID_RE.test(chatId)
  const cached = list.data?.find((c) => c.id === chatId)
  const needFallback = valid && !cached && !list.isPending && !!user
  const fallback = useQuery({
    queryKey: ['chat', chatId, 'header'],
    queryFn: () => fetchMemberChat(chatId, user!.id),
    enabled: needFallback,
  })

  if (!valid) return { status: 'missing' }
  if (cached) {
    const avatarUrl = cached.type === 'direct' ? (cached.peer?.avatarUrl ?? null) : cached.avatarUrl
    return { status: 'ready', chat: { id: cached.id, type: cached.type, title: chatTitle(cached), avatarUrl, peer: cached.peer } }
  }
  if (list.isPending) return { status: 'loading' }
  if (list.isError && !list.data) return { status: 'error', retry: () => void list.refetch() }
  if (fallback.isPending) return { status: 'loading' }
  if (fallback.isError) return { status: 'error', retry: () => void fallback.refetch() }
  if (!fallback.data) return { status: 'missing' }
  return { status: 'ready', chat: fallback.data }
}

/** Число участников группы: считаем строки chat_members (RPC списка его не отдаёт). */
export function useMemberCount(chatId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat', chatId, 'member-count'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('chat_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
      if (error) throw error
      return count
    },
  })
}

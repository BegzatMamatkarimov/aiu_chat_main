import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { MY_CHATS_KEY, useMyChats } from '@/features/chats/use-my-chats'
import { GROUPS_SEARCH_KEY } from '@/features/chats/use-public-groups'
import { supabase } from '@/lib/supabase'

export type GroupPreview = {
  id: string
  name: string
  description: string | null
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
  isPublic: boolean
}

/** Превью группы по коду приглашения; null — код недействителен. */
export function useGroupPreview(code: string) {
  return useQuery({
    queryKey: ['groups', 'preview', code],
    queryFn: async (): Promise<GroupPreview | null> => {
      const { data, error } = await supabase.rpc('get_group_by_code', { p_code: code })
      if (error) throw error
      const g = data[0]
      if (!g) return null
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        avatarUrl: g.avatar_url,
        memberCount: Number(g.member_count) || 0,
        isMember: g.is_member,
        isPublic: g.is_public !== false,
      }
    },
    retry: false,
    staleTime: 0,
  })
}

/** Вступление по коду приглашения (в том числе в непубличную группу). */
export function useJoinByCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_chat_by_code', { p_code: code })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: GROUPS_SEARCH_KEY })
      // Ждём список, чтобы строка группы уже была на месте при открытии чата.
      await qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
    },
  })
}

/** Код приглашения читается из chats: участнику он доступен по RLS. */
export function useInviteCode(chatId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat', chatId, 'invite-code'],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('chats').select('invite_code').eq('id', chatId).maybeSingle()
      if (error) throw error
      return data?.invite_code ?? null
    },
  })
}

const adminSuccessorOptions = (chatId: string, meId: string) => ({
  queryKey: ['chat', chatId, 'admin-successor'],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('chat_members')
      .select('user_id, role, joined_at, profiles(display_name)')
      .eq('chat_id', chatId)
      .order('joined_at', { ascending: true })
      .order('user_id', { ascending: true })
    if (error) throw error
    const others = data.filter((m) => m.user_id !== meId)
    if (others.length === 0 || others.some((m) => m.role === 'admin')) return null
    return others[0].profiles?.display_name?.trim() || null
  },
})

/** Кому перейдут права admin, если уйдёт последний admin: самый давний из остальных участников. */
export function useAdminSuccessor(chatId: string, enabled: boolean, meId: string | undefined) {
  return useQuery({ ...adminSuccessorOptions(chatId, meId ?? ''), enabled: enabled && !!meId })
}

/** Заранее грузит преемника для окна «Покинуть группу» (только если я admin этой группы). */
export function usePrefetchAdminSuccessor(chatId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const meId = user?.id
  const myChats = useMyChats()
  const isAdmin = myChats.data?.find((c) => c.id === chatId)?.role === 'admin'
  return useCallback(() => {
    if (isAdmin && meId) void qc.prefetchQuery(adminSuccessorOptions(chatId, meId))
  }, [qc, chatId, meId, isAdmin])
}

export function useLeaveChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase.rpc('leave_chat', { p_chat_id: chatId })
      if (error) throw error
    },
    onSuccess: (_, chatId) => {
      void qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
      void qc.invalidateQueries({ queryKey: GROUPS_SEARCH_KEY })
      qc.removeQueries({ queryKey: ['chat', chatId] })
    },
  })
}

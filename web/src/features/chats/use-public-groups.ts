import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { supabase } from '@/lib/supabase'

export type PublicGroup = {
  id: string
  name: string
  description: string | null
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
}

export const MIN_GROUP_QUERY = 2
export const GROUPS_SEARCH_KEY = ['groups', 'search'] as const

const DEBOUNCE_MS = 300

async function fetchGroups(q: string, limit: number): Promise<PublicGroup[]> {
  const { data, error } = await supabase.rpc('search_public_groups', { p_query: q, p_limit: limit })
  if (error) throw error
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    avatarUrl: g.avatar_url,
    memberCount: Number(g.member_count) || 0,
    isMember: g.is_member,
  }))
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Поиск публичных групп: debounce 300 мс, от 2 символов, предыдущий список остаётся на экране, пока грузится новый. */
export function usePublicGroupSearch(query: string) {
  const trimmed = query.trim()
  const debounced = useDebounced(trimmed, DEBOUNCE_MS)
  const active = trimmed.length >= MIN_GROUP_QUERY
  const result = useQuery({
    queryKey: [...GROUPS_SEARCH_KEY, debounced],
    queryFn: () => fetchGroups(debounced, 20),
    enabled: debounced.length >= MIN_GROUP_QUERY,
    placeholderData: keepPreviousData,
  })
  // Пока ждём debounce, поле уже изменилось, а запрос ещё не ушёл.
  const waiting = active && debounced !== trimmed
  return {
    groups: active ? result.data : undefined,
    isPending: active && (waiting || result.isPending) && !result.data,
    isError: active && !waiting && result.isError && !result.data,
    refetch: result.refetch,
    isFetching: result.isFetching,
  }
}

/** Самые большие публичные группы (пустой q возвращает все по member_count). */
export function usePopularGroups(enabled: boolean) {
  return useQuery({
    queryKey: [...GROUPS_SEARCH_KEY, 'popular'],
    queryFn: () => fetchGroups('', 10),
    enabled,
    staleTime: 60_000,
  })
}

export class JoinError extends Error {
  denied: boolean
  constructor(denied: boolean) {
    super('join failed')
    this.denied = denied
  }
}

/** Вступление в публичную группу: своя строка в chat_members с role='member' (политика chat_members_insert). */
export function useJoinGroup(meId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chatId: string) => {
      if (!meId) throw new JoinError(false)
      const { error } = await supabase.from('chat_members').insert({ chat_id: chatId, user_id: meId, role: 'member' })
      // 23505 — уже участник: считаем успехом.
      if (error && error.code !== '23505') throw new JoinError(error.code === '42501')
      return chatId
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
      void qc.invalidateQueries({ queryKey: GROUPS_SEARCH_KEY })
    },
  })
}

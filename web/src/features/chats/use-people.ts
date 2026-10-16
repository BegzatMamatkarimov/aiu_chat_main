import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { MIN_GROUP_QUERY } from '@/features/chats/use-public-groups'
import { supabase } from '@/lib/supabase'

export type Person = {
  id: string
  displayName: string
  username: string
  course: number | null
  avatarUrl: string | null
}

const DEBOUNCE_MS = 300

/** Запрос для поиска по @username: без ведущего «@» и пробелов по краям. */
export function peopleQuery(query: string) {
  return query.trim().replace(/^@+/, '').trim()
}

async function fetchPeople(q: string, meId: string): Promise<Person[]> {
  const pattern = `${q.replace(/[\\%_]/g, '\\$&')}%`
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, course, avatar_url')
    .ilike('username', pattern)
    .neq('id', meId)
    .order('username')
    .limit(10)
  if (error) throw error
  return data.flatMap((p) =>
    p.username
      ? [{ id: p.id, displayName: p.display_name ?? '', username: p.username, course: p.course, avatarUrl: p.avatar_url }]
      : [],
  )
}

/** Поиск людей по @username (префикс, без учёта регистра): debounce 300 мс, от 2 символов. */
export function usePeopleSearch(query: string, meId: string | undefined) {
  const q = peopleQuery(query)
  const [debounced, setDebounced] = useState(q)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [q])
  const active = !!meId && q.length >= MIN_GROUP_QUERY
  const result = useQuery({
    queryKey: ['people', 'search', debounced],
    queryFn: () => fetchPeople(debounced, meId as string),
    enabled: !!meId && debounced.length >= MIN_GROUP_QUERY,
    placeholderData: keepPreviousData,
  })
  const waiting = active && debounced !== q
  return {
    people: active ? result.data : undefined,
    isPending: active && (waiting || result.isPending) && !result.data,
    isError: active && !waiting && result.isError && !result.data,
    refetch: result.refetch,
    isFetching: result.isFetching,
  }
}

/** Открыть личный чат с человеком (создаётся при первом обращении). Повторный вызов, пока идёт первый, игнорируется. */
export function useOpenDirectChat() {
  const qc = useQueryClient()
  const busy = useRef(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const open = async (userId: string): Promise<string | null> => {
    if (busy.current) return null
    busy.current = true
    setPendingId(userId)
    try {
      const { data, error } = await supabase.rpc('get_or_create_direct_chat', { p_other: userId })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
      return data
    } finally {
      busy.current = false
      setPendingId(null)
    }
  }
  return { open, pendingId }
}

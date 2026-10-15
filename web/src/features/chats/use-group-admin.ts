import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { GROUPS_SEARCH_KEY } from '@/features/chats/use-public-groups'
import { supabase } from '@/lib/supabase'

export type GroupInfo = {
  id: string
  type: string
  name: string
  description: string | null
  avatarUrl: string | null
  isPublic: boolean
}

export type GroupMember = {
  userId: string
  role: 'admin' | 'member'
  joinedAt: string
  displayName: string
  username: string | null
  course: number | null
  avatarUrl: string | null
}

/** Ошибка триггера БД: в группе с участниками должен остаться admin. */
export const LAST_ADMIN_CODE = '55000'

export function isLastAdminError(e: unknown) {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === LAST_ADMIN_CODE
}

export const groupInfoKey = (chatId: string) => ['chat', chatId, 'info'] as const
export const groupMembersKey = (chatId: string) => ['chat', chatId, 'members'] as const

/** Сведения о группе; null — чата нет или нет доступа (RLS). */
export function useGroupInfo(chatId: string) {
  return useQuery({
    queryKey: groupInfoKey(chatId),
    queryFn: async (): Promise<GroupInfo | null> => {
      const { data, error } = await supabase
        .from('chats')
        .select('id, type, name, description, avatar_url, is_public')
        .eq('id', chatId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        type: data.type,
        name: data.name ?? '',
        description: data.description,
        avatarUrl: data.avatar_url,
        isPublic: data.is_public,
      }
    },
  })
}

/** Участники с профилями одним запросом: сначала admin, затем по дате вступления. */
export function useGroupMembers(chatId: string) {
  return useQuery({
    queryKey: groupMembersKey(chatId),
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from('chat_members')
        .select('user_id, role, joined_at, profiles(display_name, username, course, avatar_url)')
        .eq('chat_id', chatId)
      if (error) throw error
      return data
        .map((m) => ({
          userId: m.user_id,
          role: (m.role === 'admin' ? 'admin' : 'member') as GroupMember['role'],
          joinedAt: m.joined_at,
          displayName: m.profiles?.display_name?.trim() ?? '',
          username: m.profiles?.username ?? null,
          course: m.profiles?.course ?? null,
          avatarUrl: m.profiles?.avatar_url ?? null,
        }))
        .sort(
          (a, b) =>
            (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) ||
            a.joinedAt.localeCompare(b.joinedAt) ||
            a.userId.localeCompare(b.userId),
        )
    },
  })
}

/** Всё, что показывает группу: шапка, список, поиск, превью по ссылке, число участников. */
function useRefreshGroup(chatId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['chat', chatId] })
    void qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
    void qc.invalidateQueries({ queryKey: GROUPS_SEARCH_KEY })
    void qc.invalidateQueries({ queryKey: ['groups', 'preview'] })
  }
}

/** Правка названия, описания и типа (update chats, разрешён admin по RLS). */
export function useUpdateGroup(chatId: string) {
  const refresh = useRefreshGroup(chatId)
  return useMutation({
    mutationFn: async (v: { name: string; description: string; isPublic: boolean }) => {
      const { data, error } = await supabase
        .from('chats')
        .update({ name: v.name, description: v.description || null, is_public: v.isPublic })
        .eq('id', chatId)
        .select('id')
      if (error) throw error
      // RLS не вернёт ошибку, а просто не тронет строку, если прав нет.
      if (data.length === 0) throw new Error('not updated')
    },
    onSettled: refresh,
  })
}

export function useSetMemberRole(chatId: string) {
  const refresh = useRefreshGroup(chatId)
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => {
      const { data, error } = await supabase
        .from('chat_members')
        .update({ role })
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw error
      if (data.length === 0) throw new Error('not updated')
    },
    onSettled: refresh,
  })
}

export function useRemoveMember(chatId: string) {
  const refresh = useRefreshGroup(chatId)
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw error
      if (data.length === 0) throw new Error('not removed')
    },
    onSettled: refresh,
  })
}

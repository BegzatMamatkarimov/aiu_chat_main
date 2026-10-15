import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GROUPS_SEARCH_KEY } from '@/features/chats/use-public-groups'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { supabase } from '@/lib/supabase'

export const GROUP_NAME_MAX = 100
export const GROUP_DESCRIPTION_MAX = 500

export class CreateGroupError extends Error {
  invalidName: boolean
  constructor(invalidName: boolean) {
    super('create group failed')
    this.invalidName = invalidName
  }
}

export type NewGroup = { name: string; description: string; isPublic: boolean }

/** Создание группы через RPC create_group (создатель становится admin). Возвращает созданную группу. */
export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, description, isPublic }: NewGroup) => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: name,
        p_description: description || null,
        p_is_public: isPublic,
      })
      // 22023 — имя не прошло проверку длины на сервере.
      if (error) throw new CreateGroupError(error.code === '22023')
      return data
    },
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: GROUPS_SEARCH_KEY })
      // Ждём список, чтобы строка новой группы уже была на месте при открытии чата.
      await qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
    },
  })
}

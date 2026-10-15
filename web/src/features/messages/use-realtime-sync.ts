import { useEffect, useMemo, useRef } from 'react'
import { useMatch } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'
import { useMyChats } from '@/features/chats/use-my-chats'
import { MAX_CHANNELS, startRealtime, type RealtimeManager } from '@/features/messages/realtime-manager'

/** Один раз на приложение: каналы chat:<id> всех моих чатов + слежение за новыми чатами. Монтируется внутри RequireAuth. */
export function useRealtimeSync() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id
  const token = session?.access_token
  const openId = useMatch('/c/:chatId/*')?.params.chatId
  const chats = useMyChats().data

  const tokenRef = useRef(token)
  const openRef = useRef(openId)
  const manager = useRef<RealtimeManager | null>(null)
  useEffect(() => {
    tokenRef.current = token
    openRef.current = openId
  })

  // Приватные каналы проверяют JWT: при входе и при каждом обновлении токена передаём его в realtime.
  useEffect(() => {
    if (token) void supabase.realtime.setAuth(token).catch(() => {})
  }, [token])

  // Самые свежие MAX_CHANNELS чатов; ключ без порядка, чтобы перестановка в списке не пересобирала подписки.
  const key = useMemo(
    () =>
      [...(chats ?? [])]
        .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
        .slice(0, MAX_CHANNELS)
        .map((c) => c.id)
        .sort()
        .join(','),
    [chats],
  )
  const ids = useMemo(() => (key ? key.split(',') : []), [key])
  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  })

  useEffect(() => {
    if (!userId) return
    const m = startRealtime({
      qc,
      myId: userId,
      getToken: () => tokenRef.current,
      getOpenChatId: () => openRef.current,
    })
    manager.current = m
    m.setChats(idsRef.current)
    return () => {
      manager.current = null
      m.stop()
    }
  }, [qc, userId])

  useEffect(() => {
    manager.current?.setChats(ids)
  }, [ids, userId])
}

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Состояние перехода из чата на «О группе»: по нему «назад» понимает, что предыдущая запись истории — этот чат. */
export const FROM_CHAT_STATE = { fromChat: true }

let ownBackAt = 0

/** Был ли недавно наш собственный возврат с «О группе» (кнопка в шапке); метка одноразовая. */
export function consumeOwnInfoBack() {
  const own = performance.now() - ownBackAt < 1000
  ownBackAt = 0
  return own
}

/** Закрыть «О группе»: шаг назад по истории, если пришли из чата, иначе — замена записи на чат. */
export function useCloseInfo(chatId: string) {
  const navigate = useNavigate()
  const location = useLocation()
  const fromChat = (location.state as { fromChat?: boolean } | null)?.fromChat === true
  const inInfo = location.pathname.endsWith('/info')
  return useCallback(() => {
    // Маршрут уже сменился (системное «назад»): второй переход увёл бы дальше.
    if (!inInfo) return
    ownBackAt = performance.now()
    if (fromChat) void navigate(-1)
    else void navigate(`/c/${chatId}`, { replace: true })
  }, [chatId, fromChat, inInfo, navigate])
}

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Состояние перехода из строки списка в чат: по нему «назад» понимает, что предыдущая запись истории — список. */
export const FROM_LIST_STATE = { fromList: true }

let ownBackAt = 0

/** Пометить ближайший переход назад как «наш» (кнопка/жест приложения): его анимирует оболочка, а переход от браузера — нет. */
export function markOwnBack() {
  ownBackAt = performance.now()
}

/** Был ли недавно помечен собственный переход назад; метка одноразовая. */
export function consumeOwnBack() {
  const own = performance.now() - ownBackAt < 1000
  ownBackAt = 0
  return own
}

/** Закрыть чат: из списка — шаг назад по истории (кнопка «назад» браузера не вернёт в чат), иначе — на список с заменой записи. */
export function useCloseChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromList = (location.state as { fromList?: boolean } | null)?.fromList === true
  const inChat = location.pathname.startsWith('/c/')
  return useCallback(() => {
    // Маршрут уже сменился (системное «назад»): второй переход увёл бы из приложения.
    if (!inChat) return
    markOwnBack()
    if (fromList) void navigate(-1)
    else void navigate('/', { replace: true })
  }, [fromList, inChat, navigate])
}

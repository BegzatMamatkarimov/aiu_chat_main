import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Состояние перехода из строки списка в чат: по нему «назад» понимает, что предыдущая запись истории — список. */
export const FROM_LIST_STATE = { fromList: true }

/** Закрыть чат: из списка — шаг назад по истории (кнопка «назад» браузера не вернёт в чат), иначе — на список с заменой записи. */
export function useCloseChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromList = (location.state as { fromList?: boolean } | null)?.fromList === true
  return useCallback(() => {
    if (fromList) void navigate(-1)
    else void navigate('/', { replace: true })
  }, [fromList, navigate])
}

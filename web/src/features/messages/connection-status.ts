import { useEffect, useState, useSyncExternalStore } from 'react'

/** Плашка появляется, только если связи нет дольше этого времени: короткие переподключения не мигают. */
export const BANNER_DELAY_MS = 5000

export type ConnectionProblem = 'offline' | 'connecting'

let online = typeof navigator === 'undefined' ? true : navigator.onLine
let healthy = true
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true
    emit()
  })
  window.addEventListener('offline', () => {
    online = false
    emit()
  })
}

/** Менеджер realtime сообщает, есть ли хотя бы один рабочий канал (или каналов не требуется). */
export function setRealtimeHealthy(value: boolean) {
  if (healthy === value) return
  healthy = value
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getProblem = (): ConnectionProblem | null => (!online ? 'offline' : healthy ? null : 'connecting')

/** Что показать в плашке: null, пока всё в порядке или проблема короче BANNER_DELAY_MS. */
export function useConnectionProblem(): ConnectionProblem | null {
  const problem = useSyncExternalStore(subscribe, getProblem)
  const bad = problem !== null
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!bad) return
    const id = window.setTimeout(() => setLate(true), BANNER_DELAY_MS)
    return () => {
      window.clearTimeout(id)
      setLate(false)
    }
  }, [bad])
  return bad && late ? problem : null
}

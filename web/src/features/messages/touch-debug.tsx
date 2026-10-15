import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

const KEY = 'aiu:debug-touch'

/** Включается один раз за загрузку: ?debug=touch в URL, флаг живёт в sessionStorage. Без флага ничего не рендерится и не замеряется. */
const enabled = (() => {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === 'touch') sessionStorage.setItem(KEY, '1')
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

// Отладочный оверлей: строки намеренно не переведены (i18n не нужен).
const LABELS = { fired: 'touch→timeout fired', menu: 'touch→menu', heart: 'tap2→heart' } as const
type Key = keyof typeof LABELS

let values: Partial<Record<Key, number>> = {}
let pendingMenu: number | null = null
const listeners = new Set<() => void>()

const set = (key: Key, ms: number) => {
  values = { ...values, [key]: Math.round(ms) }
  listeners.forEach((l) => l())
}

/** Кадр после текущего: два requestAnimationFrame подряд. */
const afterFrame = (cb: () => void) => requestAnimationFrame(() => requestAnimationFrame(cb))

export const touchDebug = {
  enabled,
  /** Сработал таймер долгого нажатия; дальше ждём показ меню. */
  fired(t0: number) {
    if (!enabled) return
    pendingMenu = t0
    set('fired', performance.now() - t0)
  },
  /** Меню размещено в DOM: замер до кадра после этого. */
  menuPlaced() {
    if (!enabled || pendingMenu === null) return
    const t0 = pendingMenu
    pendingMenu = null
    afterFrame(() => set('menu', performance.now() - t0))
  },
  /** Сердце вставлено в DOM: замер от начала второго касания до кадра после него. */
  heart(t0: number) {
    if (!enabled) return
    afterFrame(() => set('heart', performance.now() - t0))
  },
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => values

export function TouchDebugOverlay() {
  const v = useSyncExternalStore(subscribe, snapshot)
  if (!enabled) return null
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-1 top-[calc(env(safe-area-inset-top)+0.25rem)] z-[100] rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] leading-tight text-white"
    >
      {(Object.keys(LABELS) as Key[]).map((k) => (
        <div key={k}>
          {LABELS[k]}: {v[k] === undefined ? '—' : `${v[k]} мс`}
        </div>
      ))}
    </div>,
    document.body,
  )
}

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

const KEY = 'aiu:debug-touch'
const FLAGS_KEY = 'aiu:debug-touch-flags'
const FLAG_NAMES = ['noscrim', 'noclip', 'noanim', 'nosurface', 'nopress'] as const
type Flag = (typeof FLAG_NAMES)[number]

/** Включается один раз за загрузку: ?debug=touch в URL, флаг и переключатели бисекции живут в sessionStorage. Без флага ничего не рендерится и не замеряется. */
const state = (() => {
  const off = { enabled: false, flags: {} as Record<Flag, boolean> }
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('debug') === 'touch') {
      sessionStorage.setItem(KEY, '1')
      sessionStorage.setItem(FLAGS_KEY, FLAG_NAMES.filter((f) => q.get(f) === '1').join(','))
    }
    if (sessionStorage.getItem(KEY) !== '1') return off
    const on = (sessionStorage.getItem(FLAGS_KEY) ?? '').split(',')
    return { enabled: true, flags: Object.fromEntries(FLAG_NAMES.map((f) => [f, on.includes(f)])) as Record<Flag, boolean> }
  } catch {
    return off
  }
})()
const enabled = state.enabled
const flags = state.flags

// Отладочный оверлей: строки намеренно не переведены (i18n не нужен).
const PHASES = {
  fired: 'timeout fired',
  open: 'open() called',
  commit: 'menu commit',
  placed: 'placed',
  raf1: 'rAF1',
  menu: 'rAF2 (=touch→menu)',
  done: 'pop-in done',
} as const
type Phase = keyof typeof PHASES
type Key = Phase | 'heart'

let values: Partial<Record<Key, number>> = {}
let t0Cur: number | null = null
let scrollerRef: HTMLElement | null = null
let info = { feed: 0, dom: 0 }
let longtask: { n: number; max: number; sum: number } | 'n/a' = 'n/a'
const listeners = new Set<() => void>()

const emit = () => {
  values = { ...values }
  listeners.forEach((l) => l())
}

/** Кадр после текущего: два requestAnimationFrame подряд. */
const afterFrame = (cb: () => void) => requestAnimationFrame(() => requestAnimationFrame(cb))

const shortUa = () => {
  const ua = navigator.userAgent
  const os = /OS (\d+[_\d]*)/.exec(ua)?.[1]?.replace(/_/g, '.')
  const br = /(Version|CriOS|FxiOS|Chrome|Firefox)\/(\d+[.\d]*)/.exec(ua)
  return [os && `iOS ${os}`, br && `${br[1]} ${br[2]}`].filter(Boolean).join(' ') || ua.slice(0, 40)
}
const ua = enabled ? shortUa() : ''

if (enabled) {
  try {
    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      longtask = { n: 0, max: 0, sum: 0 }
      new PerformanceObserver((list) => {
        if (t0Cur === null || longtask === 'n/a') return
        const lt = longtask
        for (const e of list.getEntries()) {
          if (e.startTime + e.duration < t0Cur) continue
          lt.n++
          lt.sum += e.duration
          lt.max = Math.max(lt.max, e.duration)
        }
        emit()
      }).observe({ type: 'longtask' })
    }
  } catch {
    longtask = 'n/a'
  }
}

export const touchDebug = {
  enabled,
  flags,
  /** Сработал таймер долгого нажатия: начало новой серии фаз. */
  fired(t0: number) {
    if (!enabled) return
    t0Cur = t0
    values = { heart: values.heart, fired: Math.round(performance.now() - t0) }
    if (longtask !== 'n/a') longtask = { n: 0, max: 0, sum: 0 }
    emit()
  },
  /** Фаза меню от touchstart; повторы внутри серии игнорируются. */
  mark(phase: Phase) {
    if (!enabled || t0Cur === null || values[phase] !== undefined) return
    values[phase] = Math.round(performance.now() - t0Cur)
    emit()
  },
  /** Меню размещено: rAF1 и rAF2 (кадр после размещения). */
  menuPlaced(scroller: HTMLElement) {
    if (!enabled || t0Cur === null || values.placed !== undefined) return
    touchDebug.mark('placed')
    scrollerRef = scroller
    requestAnimationFrame(() => {
      touchDebug.mark('raf1')
      requestAnimationFrame(() => {
        touchDebug.mark('menu')
        info = { feed: scrollerRef?.querySelectorAll('*').length ?? 0, dom: document.querySelectorAll('*').length }
        emit()
      })
    })
  },
  /** Сердце вставлено в DOM: замер от начала второго касания до кадра после него. */
  heart(t0: number) {
    if (!enabled) return
    afterFrame(() => {
      values.heart = Math.round(performance.now() - t0)
      emit()
    })
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
  const active = FLAG_NAMES.filter((f) => flags[f])
  const row = (label: string, val: number | undefined, na?: boolean) => (
    <div key={label}>
      {label}: {val === undefined ? (na ? 'n/a' : '—') : `${val} мс`}
    </div>
  )
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-1 top-[calc(env(safe-area-inset-top)+0.25rem)] z-[100] rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] leading-tight text-white"
    >
      <div>{ua}</div>
      <div>flags: {active.length ? active.join(' ') : 'none'}</div>
      {(Object.keys(PHASES) as Phase[]).map((k) => row(`touch→${PHASES[k]}`, v[k], k === 'done' && flags.noanim))}
      {row('tap2→heart', v.heart)}
      <div>
        DOM: feed {info.feed} / all {info.dom}
      </div>
      <div>{longtask === 'n/a' ? 'longtask: n/a' : `longtask: n=${longtask.n} max=${Math.round(longtask.max)} sum=${Math.round(longtask.sum)} мс`}</div>
    </div>,
    document.body,
  )
}

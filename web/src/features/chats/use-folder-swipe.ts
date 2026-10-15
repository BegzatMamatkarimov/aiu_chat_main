import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { animate, type AnimationPlaybackControls, type MotionValue } from 'motion/react'

const LOCK_DISTANCE = 10
const SWITCH_RATIO = 0.3
const SWITCH_VELOCITY = 500
const EDGE_RESISTANCE = 0.3
const VELOCITY_WINDOW = 100

type Sample = { x: number; t: number }
type Gesture = {
  id: number
  x: number
  y: number
  width: number
  mode: 'pending' | 'drag'
  base: number
  p: number
  samples: Sample[]
}

type Options = {
  enabled: boolean
  index: number
  count: number
  reduce: boolean
  pos: MotionValue<number>
  willChange: MotionValue<string>
  onChange: (next: number) => void
}

/**
 * Горизонтальный свайп между соседними папками. `pos` — дробный индекс папки:
 * во время жеста он следует за пальцем (без ререндеров React), после отпускания пружиной
 * доезжает до целого с начальной скоростью пальца.
 *
 * Touch events, а не pointer events: на iOS pointer events отменяются (pointercancel) при системных жестах
 * и при старте вертикальной прокрутки, а setPointerCapture ещё и может потеряться; touchcancel надёжно
 * приходит в тот же элемент, захват не нужен — касание всегда доставляется туда, где началось.
 */
export function useFolderSwipe(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const gesture = useRef<Gesture | null>(null)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const target = useRef<number | null>(null)
  const dragged = useRef(false)
  const cleanup = useRef<(() => void) | null>(null)

  /** Анимация pos к целому индексу; прерывает предыдущую. Запоминает цель, чтобы не гонять вторую анимацию поверх. */
  const settle = useCallback((to: number, velocity = 0, mode: 'spring' | 'tween' = 'spring') => {
    const { pos, reduce, willChange } = latest.current
    anim.current?.stop()
    anim.current = null
    target.current = to
    if (reduce) {
      pos.set(to)
      willChange.set('auto')
      return
    }
    const done = () => {
      if (target.current === to) willChange.set('auto')
    }
    willChange.set('transform')
    anim.current =
      mode === 'spring'
        ? animate(pos, to, { type: 'spring', stiffness: 420, damping: 40, velocity, onComplete: done })
        : animate(pos, to, { duration: 0.22, ease: [0.23, 1, 0.32, 1], onComplete: done })
  }, [])

  const finish = useCallback(
    (commit: boolean, endTime = performance.now()) => {
      const g = gesture.current
      gesture.current = null
      if (!g || g.mode !== 'drag') return
      const { index, count, onChange } = latest.current
      dragged.current = true
      window.setTimeout(() => {
        dragged.current = false
      }, 0)
      const first = g.samples[0]
      const last = g.samples[g.samples.length - 1]
      const dt = last && first && last.t > first.t ? (last.t - first.t) / 1000 : 0
      // Палец остановился до отпускания — скорость ноль.
      const stale = !last || endTime - last.t > VELOCITY_WINDOW
      const v = dt && !stale ? (last.x - first.x) / dt : 0
      const delta = g.p - index
      const fast = Math.abs(v) > SWITCH_VELOCITY
      const far = Math.abs(delta) > SWITCH_RATIO
      const dir = fast ? (v < 0 ? 1 : -1) : Math.sign(delta)
      const next = index + dir
      const velocity = -v / g.width
      if (commit && (far || fast) && dir !== 0 && next >= 0 && next < count) {
        onChange(next)
        settle(next, velocity)
      } else settle(index, velocity)
    },
    [settle],
  )

  const bind = useCallback(
    (el: HTMLElement | null) => {
      cleanup.current?.()
      cleanup.current = null
      if (!el) return

      const find = (list: TouchList, id: number) => {
        for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]
        return null
      }

      const onStart = (e: TouchEvent) => {
        const { enabled } = latest.current
        // Второй палец или выключенный свайп — отменяем текущий жест.
        if (e.touches.length > 1) return finish(false)
        if (!enabled) return
        finish(false)
        const t = e.changedTouches[0]
        gesture.current = {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          width: el.clientWidth,
          mode: 'pending',
          base: 0,
          p: 0,
          samples: [],
        }
      }

      const onMove = (e: TouchEvent) => {
        const g = gesture.current
        if (!g) return
        const t = find(e.changedTouches, g.id)
        if (!t) return
        const { count, reduce, pos, willChange, enabled } = latest.current
        if (!enabled) return finish(false)
        if (g.mode === 'pending') {
          const dx = t.clientX - g.x
          const dy = t.clientY - g.y
          if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return
          // Вертикальный жест — обычная прокрутка списка, свайп не начинаем.
          if (Math.abs(dx) <= Math.abs(dy)) {
            gesture.current = null
            return
          }
          g.mode = 'drag'
          g.x = t.clientX
          // Новое касание во время пружины: останавливаем её и берём текущую позицию трека.
          anim.current?.stop()
          anim.current = null
          target.current = null
          g.base = pos.get()
          g.p = g.base
          willChange.set('transform')
          return
        }
        if (e.cancelable) e.preventDefault()
        let p = g.base - (t.clientX - g.x) / g.width
        p = Math.max(g.base - 1, Math.min(g.base + 1, p))
        const max = count - 1
        if (p < 0) p *= EDGE_RESISTANCE
        else if (p > max) p = max + (p - max) * EDGE_RESISTANCE
        g.p = p
        g.samples.push({ x: t.clientX, t: e.timeStamp })
        while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > VELOCITY_WINDOW) g.samples.shift()
        if (!reduce) pos.set(p)
      }

      const onEnd = (e: TouchEvent) => {
        const g = gesture.current
        if (g && find(e.changedTouches, g.id)) finish(e.type === 'touchend', e.timeStamp)
      }
      const onAbort = () => finish(false)
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') finish(false)
      }

      el.addEventListener('touchstart', onStart, { passive: true })
      el.addEventListener('touchmove', onMove, { passive: false })
      el.addEventListener('touchend', onEnd, { passive: true })
      el.addEventListener('touchcancel', onEnd, { passive: true })
      window.addEventListener('blur', onAbort)
      window.addEventListener('pagehide', onAbort)
      document.addEventListener('visibilitychange', onVisibility)
      cleanup.current = () => {
        el.removeEventListener('touchstart', onStart)
        el.removeEventListener('touchmove', onMove)
        el.removeEventListener('touchend', onEnd)
        el.removeEventListener('touchcancel', onEnd)
        window.removeEventListener('blur', onAbort)
        window.removeEventListener('pagehide', onAbort)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },
    [finish],
  )

  useEffect(
    () => () => {
      cleanup.current?.()
      anim.current?.stop()
    },
    [],
  )

  // Свайп выключили (поиск, десктоп, загрузка) посреди жеста — откатываем.
  useEffect(() => {
    if (!options.enabled) finish(false)
  }, [options.enabled, finish])

  /** Переход к папке не жестом (вкладка): не трогаем, если пружина уже летит к ней. */
  const goTo = useCallback(
    (to: number) => {
      if (target.current === to) return
      settle(to, 0, 'tween')
    },
    [settle],
  )

  const clickCapture = useCallback((e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (!dragged.current) return
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return {
    bind,
    goTo,
    clickCapture,
  }
}

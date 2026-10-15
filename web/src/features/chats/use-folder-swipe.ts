import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, type MotionValue } from 'motion/react'

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
  dx: number
  samples: Sample[]
}

/**
 * Горизонтальный свайп между соседними папками. `pos` — дробный индекс папки:
 * во время жеста он следует за пальцем, после отпускания пружиной доезжает до целого.
 */
export function useFolderSwipe({
  enabled,
  index,
  count,
  reduce,
  pos,
  onChange,
}: {
  enabled: boolean
  index: number
  count: number
  reduce: boolean
  pos: MotionValue<number>
  onChange: (next: number) => void
}) {
  const gesture = useRef<Gesture | null>(null)
  const dragged = useRef(false)

  const settle = (target: number, velocity = 0) => {
    if (reduce) pos.set(target)
    else animate(pos, target, { type: 'spring', stiffness: 420, damping: 40, velocity })
  }

  const finish = (commit: boolean) => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.mode !== 'drag') return
    dragged.current = true
    window.setTimeout(() => {
      dragged.current = false
    }, 0)
    if (!commit) return settle(index)
    const first = g.samples[0]
    const last = g.samples[g.samples.length - 1]
    const dt = last && first && last.t > first.t ? (last.t - first.t) / 1000 : 0
    const v = dt ? (last.x - first.x) / dt : 0
    const dir = g.dx < 0 ? 1 : -1
    const fast = Math.abs(v) > SWITCH_VELOCITY && Math.sign(v) === -dir
    const far = Math.abs(g.dx) / g.width > SWITCH_RATIO
    const next = index + dir
    if ((far || fast) && next >= 0 && next < count) {
      onChange(next)
      settle(next, -v / g.width)
    } else settle(index, -v / g.width)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType !== 'touch' || !e.isPrimary) return
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      width: e.currentTarget.clientWidth,
      mode: 'pending',
      dx: 0,
      samples: [],
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.mode === 'pending') {
      if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return
      // Вертикальный жест — обычная прокрутка списка, свайп не начинаем.
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.current = null
        return
      }
      g.mode = 'drag'
      g.x = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const raw = Math.max(-g.width, Math.min(g.width, dx))
    const atEdge = (index === 0 && raw > 0) || (index === count - 1 && raw < 0)
    g.dx = atEdge ? raw * EDGE_RESISTANCE : raw
    g.samples.push({ x: e.clientX, t: e.timeStamp })
    while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > VELOCITY_WINDOW) g.samples.shift()
    if (!reduce) pos.set(index - g.dx / g.width)
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        if (gesture.current?.id === e.pointerId) finish(true)
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
        if (gesture.current?.id === e.pointerId) finish(false)
      },
      onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
        if (!dragged.current) return
        e.preventDefault()
        e.stopPropagation()
      },
    },
    settle,
  }
}

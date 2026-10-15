import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { animate, type AnimationPlaybackControls } from 'motion/react'

const LONG_PRESS_MS = 400
/** Сдвиг пальца, после которого долгое нажатие отменяется (это уже прокрутка или свайп). */
const MOVE_CANCEL = 8
const LOCK_DISTANCE = 10
const REPLY_THRESHOLD = 56
const MAX_PULL = 88
// Зона системного жеста «назад» у левого края экрана.
const SYSTEM_EDGE = 20

type Gesture = {
  id: number
  msgId: string
  bubble: HTMLElement
  row: HTMLElement
  x0: number
  y0: number
  /** Точка, где распознан горизонтальный жест: от неё считается сдвиг, чтобы пузырь не прыгал. */
  sx: number
  mode: 'pending' | 'swipe' | 'dead'
  timer: number | undefined
  crossed: boolean
  pull: number
}

type Options = {
  reduce: boolean
  canMenu: (id: string) => boolean
  canReply: (id: string) => boolean
  onLongPress: (id: string, bubble: HTMLElement) => void
  onReply: (id: string) => void
}

const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* на iOS и в части браузеров вибрации нет */
  }
}

/** Видимый сдвиг пузыря: до порога следует за пальцем, дальше тянется с сопротивлением. */
const visual = (pull: number) => Math.min(MAX_PULL, pull <= REPLY_THRESHOLD ? pull : REPLY_THRESHOLD + (pull - REPLY_THRESHOLD) * 0.25)

function apply(row: HTMLElement, x: number) {
  if (x <= 0.01) {
    row.style.removeProperty('--sx')
    row.style.removeProperty('--sp')
    return
  }
  row.style.setProperty('--sx', `${x.toFixed(1)}px`)
  row.style.setProperty('--sp', Math.min(1, x / REPLY_THRESHOLD).toFixed(3))
}

/**
 * Жесты на пузырях ленты (делегирование на контейнере): долгое нажатие открывает меню, свайп вправо — ответ.
 * Touch events, как в use-folder-swipe: на iOS pointer events отменяются при прокрутке; preventDefault только при горизонтальном жесте.
 */
export function useMessageTouch(ref: RefObject<HTMLElement | null>, options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let g: Gesture | null = null
    let spring: AnimationPlaybackControls | null = null
    let springRow: HTMLElement | null = null
    let suppressClick = false
    let suppressTimer: number | undefined

    const settleBack = (row: HTMLElement, from: number) => {
      spring?.stop()
      if (springRow && springRow !== row) apply(springRow, 0)
      springRow = row
      if (latest.current.reduce || from <= 0.5) {
        apply(row, 0)
        row.style.removeProperty('will-change')
        return
      }
      spring = animate(from, 0, {
        type: 'spring',
        stiffness: 520,
        damping: 36,
        onUpdate: (v) => apply(row, Math.max(0, v)),
        onComplete: () => {
          apply(row, 0)
          row.style.removeProperty('will-change')
        },
      })
    }

    const end = (reply: boolean) => {
      const cur = g
      g = null
      if (!cur) return
      window.clearTimeout(cur.timer)
      if (cur.mode === 'swipe') {
        const hit = reply && cur.pull >= REPLY_THRESHOLD
        settleBack(cur.row, visual(cur.pull))
        if (hit) latest.current.onReply(cur.msgId)
      }
    }

    const find = (list: TouchList, id: number) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]
      return null
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return end(false)
      end(false)
      const target = e.target instanceof Element ? e.target : null
      const bubble = target?.closest<HTMLElement>('[data-bubble]')
      const row = bubble?.closest<HTMLElement>('[data-msg-row]')
      const msgId = bubble?.dataset.msgId
      if (!bubble || !row || !msgId || !el.contains(bubble)) return
      // Новое касание во время пружины: фиксируем текущее положение, чтобы не дёргать.
      spring?.stop()
      const t = e.changedTouches[0]
      const next: Gesture = {
        id: t.identifier,
        msgId,
        bubble,
        row,
        x0: t.clientX,
        y0: t.clientY,
        sx: t.clientX,
        mode: 'pending',
        timer: undefined,
        crossed: false,
        pull: 0,
      }
      if (latest.current.canMenu(msgId)) {
        next.timer = window.setTimeout(() => {
          if (g !== next || next.mode !== 'pending') return
          next.mode = 'dead'
          suppressClick = true
          vibrate(10)
          latest.current.onLongPress(msgId, bubble)
        }, LONG_PRESS_MS)
      }
      g = next
    }

    const onMove = (e: TouchEvent) => {
      const cur = g
      if (!cur) return
      const t = find(e.changedTouches, cur.id)
      if (!t) return
      const dx = t.clientX - cur.x0
      const dy = t.clientY - cur.y0
      if (cur.mode === 'pending') {
        if (Math.hypot(dx, dy) > MOVE_CANCEL) window.clearTimeout(cur.timer)
        if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return
        const horizontalRight = Math.abs(dx) > Math.abs(dy) && dx > 0
        if (horizontalRight && cur.x0 >= SYSTEM_EDGE && latest.current.canReply(cur.msgId)) {
          cur.mode = 'swipe'
          cur.sx = t.clientX
          cur.row.style.setProperty('will-change', 'transform')
        } else {
          cur.mode = 'dead'
          return
        }
      }
      if (cur.mode !== 'swipe') return
      if (e.cancelable) e.preventDefault()
      cur.pull = Math.max(0, t.clientX - cur.sx)
      const crossed = cur.pull >= REPLY_THRESHOLD
      if (crossed !== cur.crossed) {
        cur.crossed = crossed
        if (crossed) vibrate(8)
      }
      apply(cur.row, visual(cur.pull))
    }

    const onFinish = (e: TouchEvent) => {
      const cur = g
      if (!cur || !find(e.changedTouches, cur.id)) return
      if (suppressClick) {
        window.clearTimeout(suppressTimer)
        suppressTimer = window.setTimeout(() => {
          suppressClick = false
        }, 500)
      }
      end(e.type === 'touchend')
    }

    // После долгого нажатия отпускание не должно «кликнуть» по ссылке или цитате под пальцем.
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      e.preventDefault()
      e.stopPropagation()
    }
    const abort = () => end(false)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') end(false)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onFinish, { passive: true })
    el.addEventListener('touchcancel', onFinish, { passive: true })
    el.addEventListener('click', onClickCapture, true)
    window.addEventListener('blur', abort)
    window.addEventListener('pagehide', abort)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onFinish)
      el.removeEventListener('touchcancel', onFinish)
      el.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('blur', abort)
      window.removeEventListener('pagehide', abort)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(g?.timer)
      window.clearTimeout(suppressTimer)
      spring?.stop()
      if (springRow) apply(springRow, 0)
      if (g) apply(g.row, 0)
    }
  }, [ref])

}

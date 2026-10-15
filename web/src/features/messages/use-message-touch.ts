import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { animate, type AnimationPlaybackControls } from 'motion/react'
import { touchDebug } from '@/features/messages/touch-debug'

const LONG_PRESS_MS = 350
/** Через сколько мс удержания (палец на месте) пузырь начинает «вжиматься» — обратная связь до открытия меню. */
const PRESS_FEEDBACK_MS = 120
const PRESS_SCALE = 0.96
/** Двойной тап: второе касание не позже чем через столько мс и в пределах столько px от первого. */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DIST = 24
/** Элементы внутри пузыря со своим действием: на них двойной тап не срабатывает. */
const OWN_ACTION = 'a, button, [role="button"]'
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
  pressTimer: number | undefined
  pressed: boolean
  /** Время касания (как у события): точка отсчёта замеров ?debug=touch. */
  t0: number
  /** Касание началось не на ссылке, цитате или чипе. */
  plain: boolean
  crossed: boolean
  pull: number
}

type Options = {
  reduce: boolean
  canMenu: (id: string) => boolean
  canReply: (id: string) => boolean
  canReact: (id: string) => boolean
  onLongPress: (id: string, bubble: HTMLElement) => void
  onReply: (id: string) => void
  /** Двойной тап / двойной клик по пузырю: быстрая реакция. t0 — начало второго касания. */
  onDoubleTap: (id: string, bubble: HTMLElement, t0: number) => void
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
    let lastTap: { id: string; x: number; y: number; at: number } | null = null
    let lastTouchEnd = 0

    /** Пузырь возвращается из «вжатия»: быстро (отпускание, сдвиг) или мгновенно (меню: рамка под затемнение считается без transform). */
    const unpress = (cur: Gesture, instant = false) => {
      window.clearTimeout(cur.pressTimer)
      if (!cur.pressed) return
      cur.pressed = false
      const st = cur.bubble.style
      st.transition = instant ? 'none' : 'transform 120ms cubic-bezier(0.23, 1, 0.32, 1)'
      st.removeProperty('transform')
    }

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
      unpress(cur)
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
        pressTimer: undefined,
        pressed: false,
        t0: e.timeStamp,
        plain: !target?.closest(OWN_ACTION),
        crossed: false,
        pull: 0,
      }
      if (latest.current.canMenu(msgId)) {
        next.timer = window.setTimeout(() => {
          if (g !== next || next.mode !== 'pending') return
          next.mode = 'dead'
          suppressClick = true
          unpress(next, true)
          touchDebug.fired(next.t0)
          vibrate(10)
          latest.current.onLongPress(msgId, bubble)
        }, LONG_PRESS_MS)
        if (!latest.current.reduce) {
          // Плавное вжатие за оставшееся до порога время, только transform.
          next.pressTimer = window.setTimeout(() => {
            if (g !== next || next.mode !== 'pending') return
            next.pressed = true
            const st = bubble.style
            st.transition = `transform ${LONG_PRESS_MS - PRESS_FEEDBACK_MS}ms cubic-bezier(0, 0, 0.2, 1)`
            st.transform = `scale(${PRESS_SCALE})`
          }, PRESS_FEEDBACK_MS)
        }
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
        if (Math.hypot(dx, dy) > MOVE_CANCEL) {
          window.clearTimeout(cur.timer)
          unpress(cur)
        }
        if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return
        const horizontalRight = Math.abs(dx) > Math.abs(dy) && dx > 0
        if (horizontalRight && cur.x0 >= SYSTEM_EDGE && latest.current.canReply(cur.msgId)) {
          cur.mode = 'swipe'
          unpress(cur)
          cur.sx = t.clientX
          cur.row.style.setProperty('will-change', 'transform')
        } else {
          cur.mode = 'dead'
          unpress(cur)
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
      const up = find(e.changedTouches, cur.id)
      if (e.type === 'touchend') {
        lastTouchEnd = performance.now()
        const tapped = cur.mode === 'pending' && !!up && Math.hypot(up.clientX - cur.x0, up.clientY - cur.y0) <= MOVE_CANCEL
        const prev = lastTap
        lastTap = null
        if (tapped && cur.plain && latest.current.canReact(cur.msgId)) {
          if (prev && prev.id === cur.msgId && cur.t0 - prev.at <= DOUBLE_TAP_MS && Math.hypot(cur.x0 - prev.x, cur.y0 - prev.y) <= DOUBLE_TAP_DIST) {
            latest.current.onDoubleTap(cur.msgId, cur.bubble, cur.t0)
          } else {
            lastTap = { id: cur.msgId, x: up.clientX, y: up.clientY, at: performance.now() }
          }
        }
      }
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
    // Мышь: двойной клик по пузырю (не по ссылке, цитате, чипу). Двойной тап пальцем уже обработан выше.
    const onDblClick = (e: MouseEvent) => {
      if (performance.now() - lastTouchEnd < 800) return
      const target = e.target instanceof Element ? e.target : null
      const bubble = target?.closest<HTMLElement>('[data-bubble]')
      const id = bubble?.dataset.msgId
      if (!bubble || !id || !el.contains(bubble) || target?.closest(OWN_ACTION)) return
      if (latest.current.canReact(id)) latest.current.onDoubleTap(id, bubble, e.timeStamp)
    }
    // Второй клик серии не выделяет слово.
    const onMouseDown = (e: MouseEvent) => {
      if (e.detail < 2) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('[data-bubble]') && !target.closest(OWN_ACTION)) e.preventDefault()
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
    el.addEventListener('dblclick', onDblClick)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('blur', abort)
    window.addEventListener('pagehide', abort)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onFinish)
      el.removeEventListener('touchcancel', onFinish)
      el.removeEventListener('click', onClickCapture, true)
      el.removeEventListener('dblclick', onDblClick)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('blur', abort)
      window.removeEventListener('pagehide', abort)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(g?.timer)
      if (g) unpress(g, true)
      window.clearTimeout(suppressTimer)
      spring?.stop()
      if (springRow) apply(springRow, 0)
      if (g) apply(g.row, 0)
    }
  }, [ref])

}

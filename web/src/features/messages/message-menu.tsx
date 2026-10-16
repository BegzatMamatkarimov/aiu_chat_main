import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type Ref, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/features/messages/message-model'


const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
/** Реакция двойного тапа. */
export const HEART_REACTION = QUICK_REACTIONS[1]

export type MenuItem = { key: string; label: string; icon: ReactNode; danger?: boolean; run: () => void }

export type MenuVia = 'mouse' | 'key' | 'hold'

type Props = {
  /** Пузырь, к которому привязано меню (его область остаётся видимой). */
  anchor: HTMLElement
  /** Лента: её верх — граница сверху (под шапкой). */
  scroller: HTMLElement
  mine: boolean
  via: MenuVia
  /** Эмодзи, которые уже поставил я. null — панели реакций нет. */
  myReactions: ReadonlySet<string> | null
  items: MenuItem[]
  onReact: (emoji: string) => void
  onClose: () => void
}

type Layout = {
  bar: { left: number; top: number; ox: number; oy: number }
  list: { left: number; top: number; ox: number; oy: number }
  spot: { left: number; top: number; width: number; height: number }
}

const GAP = 8
const MARGIN = 8
/** Нажатие в первые мс после открытия и до отпускания пальца — это не выбор пункта и не тап мимо. */
const GHOST_MS = 350
const TAIL = 8

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, hi < lo ? lo : v))

function compute(anchor: HTMLElement, scroller: HTMLElement, mine: boolean, bar: HTMLElement | null, list: HTMLElement): Layout {
  const vv = window.visualViewport
  const vLeft = vv?.offsetLeft ?? 0
  const vTop = vv?.offsetTop ?? 0
  const vRight = vLeft + (vv?.width ?? window.innerWidth)
  const vBottom = vTop + (vv?.height ?? window.innerHeight)
  const sc = scroller.getBoundingClientRect()
  const topB = Math.max(vTop, sc.top) + MARGIN
  const botB = vBottom - MARGIN
  const r = anchor.getBoundingClientRect()
  const bh = bar?.offsetHeight ?? 0
  const bw = bar?.offsetWidth ?? 0
  const lh = list.offsetHeight
  const lw = list.offsetWidth
  const needAbove = bh ? bh + GAP : 0
  const roomAbove = r.top - topB
  const roomBelow = botB - r.bottom

  let barTop = 0
  let listTop = 0
  if (roomAbove >= needAbove && roomBelow >= lh + GAP) {
    barTop = r.top - GAP - bh
    listTop = r.bottom + GAP
  } else if (roomAbove >= needAbove + lh + GAP) {
    // Снизу места нет (последнее сообщение над полем ввода): панель и пункты — над пузырём.
    listTop = r.top - GAP - lh
    barTop = listTop - GAP - bh
  } else if (roomBelow >= needAbove + lh + GAP) {
    barTop = r.bottom + GAP
    listTop = barTop + bh + (bh ? GAP : 0)
  } else {
    // Высокий пузырь: прижимаем всё к границам, пересекаясь с пузырём.
    const total = bh + (bh ? GAP : 0) + lh
    barTop = clamp(r.top - GAP - bh, topB, botB - total)
    listTop = barTop + bh + (bh ? GAP : 0)
  }

  const align = (w: number) => clamp(mine ? r.right - w : r.left, vLeft + MARGIN, vRight - MARGIN - w)
  const barLeft = align(bw)
  const listLeft = align(lw)
  const ax = mine ? r.right - 20 : r.left + 20
  const barAbove = barTop + bh <= r.top + 1
  const listBelow = listTop >= r.bottom - 1
  const spotTop = clamp(r.top, sc.top, vBottom)
  const spotBottom = clamp(r.bottom, sc.top, vBottom)

  return {
    bar: { left: barLeft, top: barTop, ox: clamp(ax - barLeft, 0, bw), oy: barAbove ? bh : 0 },
    list: { left: listLeft, top: listTop, ox: clamp(ax - listLeft, 0, lw), oy: listBelow ? 0 : lh },
    spot: {
      left: mine ? r.left : r.left - TAIL,
      top: spotTop,
      width: r.width + TAIL,
      height: Math.max(0, spotBottom - spotTop),
    },
  }
}

/** Весь экран, кроме скруглённого прямоугольника под пузырём (even-odd): затемнение без гигантской тени. */
function spotClip({ left, top, width, height }: Layout['spot']) {
  // Внешний контур ровно по экрану: больший контур раздувает слой.
  const outer = `M0 0H${window.innerWidth}V${window.innerHeight}H0Z`
  if (width <= 0 || height <= 0) return `path(evenodd, "${outer}")`
  const r = Math.min(16, width / 2, height / 2)
  const right = left + width
  const bottom = top + height
  const hole =
    `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}` +
    `H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`
  return `path(evenodd, "${outer}${hole}")`
}

/** Меню сообщения: панель реакций над пузырём, пункты под ним; на телефоне фон затемнён, пузырь остаётся видимым. */
export function MessageMenu({ anchor, scroller, mine, via, myReactions, items, onReact, onClose }: Props) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [dim] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  const armedAt = useRef(0)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list || !anchor.isConnected) return
    setLayout(compute(anchor, scroller, mine, barRef.current, list))
  }, [anchor, scroller, mine])

  const hasBar = myReactions !== null
  useLayoutEffect(() => {
    measure()
  }, [measure, items.length, hasBar])
  useLayoutEffect(() => {
    armedAt.current = via === 'hold' ? Number.POSITIVE_INFINITY : performance.now() + 120
  }, [via])

  // Лента могла сдвинуться (пришло сообщение), окно или клавиатура поменяли размер: следуем за пузырём.
  useEffect(() => {
    const vv = window.visualViewport
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [scroller, measure])

  // Меню открыто удержанием: тап «мимо» и пункты ждут отпускания пальца, иначе подъём пальца сразу закроет меню или выберет пункт.
  useEffect(() => {
    if (via !== 'hold') return
    const release = () => {
      armedAt.current = performance.now() + GHOST_MS
      window.removeEventListener('touchend', release, true)
      window.removeEventListener('touchcancel', release, true)
    }
    window.addEventListener('touchend', release, true)
    window.addEventListener('touchcancel', release, true)
    return () => {
      window.removeEventListener('touchend', release, true)
      window.removeEventListener('touchcancel', release, true)
    }
  }, [via])

  // Фокус: с клавиатуры — на первый пункт, иначе на само меню (скрытые до расчёта места элементы фокус не берут).
  const placed = layout !== null
  useEffect(() => {
    if (!placed) return
    const root = rootRef.current
    if (via === 'key') root?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
    else root?.focus({ preventScroll: true })
  }, [placed, via])

  // Esc закрывает; при закрытии фокус возвращается на пузырь.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const active = document.activeElement
      if ((!active || active === document.body || !active.isConnected) && anchor.isConnected) anchor.focus({ preventScroll: true })
    }
  }, [anchor, via])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root) return
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')]
    if (buttons.length === 0) return
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (e.key === 'Tab') next = e.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at + 1) % buttons.length
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (at + 1) % buttons.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = at <= 0 ? buttons.length - 1 : at - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    if (next < 0) return
    e.preventDefault()
    buttons[next].focus({ preventScroll: true })
  }

  const guard = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (performance.now() >= armedAt.current) return
    e.preventDefault()
    e.stopPropagation()
  }

  const place = (p: Layout['bar'] | undefined): CSSProperties =>
    p
      ? { left: p.left, top: p.top, transformOrigin: `${p.ox}px ${p.oy}px` }
      : { left: 0, top: 0, visibility: 'hidden' }

  const surface = cn('glass-menu-surface', 'glass-menu-pop')

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] outline-none [touch-action:none] [-webkit-touch-callout:none]"
      onClickCapture={guard}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (e.target === e.currentTarget && performance.now() >= armedAt.current) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      {dim && layout && (
        <div
          aria-hidden="true"
          className={cn('glass-menu-scrim pointer-events-none fixed inset-0', 'glass-menu-fade')}
          style={{ clipPath: spotClip(layout.spot) }}
        />
      )}
      {myReactions && (
        <div
          ref={barRef}
          role="group"
          aria-label={t('chat.msgMenu.reactions')}
          className={cn('fixed flex gap-0.5 p-1.5', surface, 'rounded-full')}
          style={place(layout?.bar)}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={myReactions.has(emoji)}
              onClick={() => onReact(emoji)}
              className="glass-menu-emoji flex size-10 items-center justify-center rounded-full text-[1.5rem] leading-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div
        ref={listRef}
        role="menu"
        aria-label={t('chat.msgMenu.label')}
        className={cn('fixed w-[min(14rem,calc(100vw-1rem))] overflow-hidden py-1', surface, 'rounded-2xl')}
        style={place(layout?.list)}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            onClick={item.run}
            className={cn(
              'glass-menu-item flex h-11 w-full items-center gap-3 px-4 text-left text-[0.9375rem]',
              item.danger && 'text-destructive',
            )}
          >
            <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export type MenuOpen = { id: string; bubble: HTMLElement; scroller: HTMLElement; via: MenuVia }
export type MenuHandle = { open: (s: MenuOpen) => void; close: () => void }

type HostProps = {
  ref: Ref<MenuHandle>
  messages: ChatMessage[]
  myId: string | undefined
  buildItems: (m: ChatMessage, close: () => void) => MenuItem[]
  onReact: (id: string, emoji: string) => void
}

/** Слой меню со своим состоянием: открытие и закрытие не перерисовывают ленту. */
export function MessageMenuHost({ ref, messages, myId, buildItems, onReact }: HostProps) {
  const [menu, setMenu] = useState<MenuOpen | null>(null)
  const close = useCallback(() => setMenu(null), [])
  useImperativeHandle(
    ref,
    () => ({
      open: (s) => {
        setMenu((cur) => (cur && cur.id === s.id ? cur : s))
      },
      close,
    }),
    [close],
  )

  const msg = menu ? messages.find((m) => m.id === menu.id) : undefined
  if (!menu || !msg || msg.deleted)
    // Невидимый прогрев: шрифт эмодзи и их раскладка кешируются до первого открытия меню (иначе первое открытие дольше).
    return (
      <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-[0.01]">
        <span className="text-[1.5rem] leading-none">{QUICK_REACTIONS.join('')}</span>
      </div>
    )
  return (
    <MessageMenu
      anchor={menu.bubble}
      scroller={menu.scroller}
      mine={msg.senderId === myId}
      via={menu.via}
      myReactions={msg.status === 'sent' ? new Set(msg.reactions.filter((r) => r.mine).map((r) => r.emoji)) : null}
      items={buildItems(msg, close)}
      onReact={(emoji) => {
        menu.bubble.focus({ preventScroll: true })
        close()
        onReact(msg.id, emoji)
      }}
      onClose={close}
    />
  )
}

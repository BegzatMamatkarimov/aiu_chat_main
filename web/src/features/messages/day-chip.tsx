import { useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDayLabel } from '@/features/messages/message-model'

/** Верхний отступ прилипшей даты, px (совпадает с top-1). */
const STICKY_TOP = 4

/**
 * Разделитель дня. Он же «плавающая» дата: прилипает к верху ленты, а в покое прилипший скрывается
 * (data-stuck + data-scrolling на ленте управляют видимостью в CSS, без перерисовки React).
 */
export function DayChip({ ts, scrollerRef }: { ts: number; scrollerRef: RefObject<HTMLElement | null> }) {
  const { i18n } = useTranslation()
  const sentinel = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const target = sentinel.current
    const root = scrollerRef.current
    const el = chip.current
    if (!target || !root || !el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        el.dataset.stuck = String(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0))
      },
      { root, rootMargin: `-${STICKY_TOP}px 0px 0px 0px`, threshold: 0 },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [scrollerRef])

  return (
    <>
      <div ref={sentinel} className="h-0" aria-hidden="true" />
      <div className="pointer-events-none sticky top-1 z-10 flex justify-center py-1.5">
        <span ref={chip} className="glass-day glass-pill rounded-full px-3 py-1 text-xs font-medium text-foreground/80 shadow-md">
          {formatDayLabel(ts, i18n.language)}
        </span>
      </div>
    </>
  )
}

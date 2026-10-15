import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType, useOutlet } from 'react-router'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { GlassBackground, GlassPattern } from '@/components/glass/glass-background'
import { consumeOwnInfoBack } from '@/features/messages/use-close-info'
import { EASE_DRAWER } from '@/lib/motion'
import { useIsDesktop } from '@/lib/use-media-query'

/**
 * Слой «О группе» поверх чата (вложенный маршрут `info`). Положение выводится из маршрута:
 * на телефоне выезжает справа, на десктопе просто занимает правую панель. Переход от браузера
 * (системное «назад») не анимируем — он уже показал свой переход; анимируем наши PUSH и «назад» из приложения.
 */
export function InfoLayer() {
  const outlet = useOutlet()
  const open = outlet !== null
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  const navType = useNavigationType()
  const { key } = useLocation()
  const seen = useRef('')
  const own = useRef(false)
  // Держим экран на месте, пока слой уезжает вправо: маршрут уже сменился на чат.
  const [kept, setKept] = useState<ReactNode>(null)
  if (open && kept !== outlet) setKept(outlet)

  const x = useMotionValue(open ? 0 : 100)
  const xPercent = useTransform(x, (v) => `${v}%`)
  const edgeOpacity = useTransform(x, [85, 100], [1, 0])

  useEffect(() => {
    const target = open ? 0 : 100
    if (seen.current !== key) {
      seen.current = key
      own.current = consumeOwnInfoBack()
    }
    if (desktop || reduce || (navType === 'POP' && !own.current)) {
      x.set(target)
      let cancelled = false
      void Promise.resolve().then(() => {
        if (!cancelled && !open) setKept(null)
      })
      return () => {
        cancelled = true
      }
    }
    let cancelled = false
    const c = animate(x, target, { duration: 0.28, ease: EASE_DRAWER })
    void c.then(() => {
      if (!cancelled && !open) setKept(null)
    })
    return () => {
      cancelled = true
      c.stop()
    }
    // key: каждая новая запись истории пересчитывает положение, даже если open не изменился.
  }, [open, desktop, x, reduce, navType, key])

  return (
    <motion.div
      className="absolute inset-0 z-30 bg-background md:bg-transparent"
      style={{ x: xPercent, visibility: open || kept ? 'visible' : 'hidden' }}
      inert={!open}
    >
      <motion.div aria-hidden="true" className="glass-edge pointer-events-none absolute inset-0 md:hidden" style={{ opacity: edgeOpacity }} />
      <GlassBackground className="md:hidden" />
      <GlassPattern />
      <div className="relative h-full">{open ? outlet : kept}</div>
    </motion.div>
  )
}

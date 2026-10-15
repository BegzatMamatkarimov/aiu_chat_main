import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation, useMatch, useNavigationType, useOutlet } from 'react-router'
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { GlassBackground } from '@/components/glass/glass-background'
import { ChatListPanel } from '@/features/chats/chat-list-panel'
import { consumeOwnBack, useCloseChat } from '@/features/chats/use-close-chat'
import { EASE_DRAWER } from '@/lib/motion'
import { useIsDesktop } from '@/lib/use-media-query'

const LIST_WIDTH = 360
const EDGE_WIDTH = 24
const BACK_DISTANCE = 0.33
const BACK_VELOCITY = 500

/** Установленное приложение без интерфейса браузера: системного жеста «назад» нет, нужен собственный свайп от края. */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return w
}

/** Каркас: на десктопе список и чат рядом, на телефоне экраны по очереди со сдвигом справа. */
export function AppShell() {
  const desktop = useIsDesktop()
  const open = useMatch('/c/:chatId') !== null

  return (
    <div className="h-dvh overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {desktop ? (
        <div className="flex h-full min-h-0">
          <aside className="min-w-0 shrink-0 border-r border-border" style={{ width: LIST_WIDTH }}>
            <ChatListPanel />
          </aside>
          <main className="relative min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      ) : (
        <MobileStack open={open} />
      )}
    </div>
  )
}

function MobileStack({ open }: { open: boolean }) {
  const back = useCloseChat()
  const reduce = useReducedMotion()
  const w = useViewportWidth()
  const outlet = useOutlet()
  const navType = useNavigationType()
  const { key } = useLocation()
  const standalone = isStandalone()
  const seen = useRef('')
  const own = useRef(false)
  // Держим чат на месте, пока панель уезжает вправо: маршрут уже сменился на «/».
  const [kept, setKept] = useState<ReactNode>(null)
  if (open && kept !== outlet) setKept(outlet)

  const x = useMotionValue(open ? 0 : w)
  const controls = useDragControls()
  const listX = useTransform(x, [0, w], [-w * 0.22, 0])
  const listOpacity = useTransform(x, [0, w], [0.5, 1])
  const edgeOpacity = useTransform(x, [w * 0.85, w], [1, 0])

  // Положение экрана выводится из маршрута. Переход от браузера (POP: системное «назад», свайп Safari)
  // не анимируем — браузер уже показал свой переход; анимируем наши PUSH/REPLACE и «назад» из приложения.
  useEffect(() => {
    const target = open ? 0 : w
    if (seen.current !== key) {
      seen.current = key
      own.current = consumeOwnBack()
    }
    if (reduce || (navType === 'POP' && !own.current)) {
      x.set(target)
      return
    }
    const c = animate(x, target, { duration: 0.28, ease: EASE_DRAWER })
    return () => c.stop()
    // key: каждая новая запись истории пересчитывает положение, даже если open не изменился.
  }, [open, w, x, reduce, navType, key])

  return (
    <div className="relative h-full overflow-hidden">
      <motion.aside className="absolute inset-0" style={{ x: listX, opacity: listOpacity }} inert={open}>
        <ChatListPanel />
      </motion.aside>
      <motion.main
        className="absolute inset-0 bg-background"
        style={{ x }}
        drag={standalone && open ? 'x' : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ left: 0, right: w }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x > w * BACK_DISTANCE || info.velocity.x > BACK_VELOCITY) back()
          else animate(x, 0, { type: 'spring', duration: 0.35, bounce: 0.15 })
        }}
        inert={!open}
      >
        <motion.div aria-hidden="true" className="glass-edge pointer-events-none absolute inset-0" style={{ opacity: edgeOpacity }} />
        <GlassBackground />
        <div className="relative h-full">{open ? outlet : kept}</div>
        {standalone && open && (
          <div
            className="absolute bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-40"
            style={{ width: EDGE_WIDTH, touchAction: 'none' }}
            onPointerDown={(e) => controls.start(e)}
            aria-hidden="true"
          />
        )}
      </motion.main>
    </div>
  )
}

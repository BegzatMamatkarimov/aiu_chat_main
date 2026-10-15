import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { EASE_DRAWER, EASE_OUT } from '@/lib/motion'
import { useIsDesktop } from '@/lib/use-media-query'

const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 600

/** Телефон: экранная клавиатура сужает видимую область, лист поднимается над ней, а кнопка отправки остаётся на виду. */
function useKeyboardFit(active: boolean) {
  const [fit, setFit] = useState({ bottom: 0, height: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () =>
      setFit({
        bottom: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        height: Math.round(vv.height),
      })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return fit
}

/** Окно с формой: на десктопе диалог по центру, на телефоне нижний лист, который закрывается свайпом вниз. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  describedBy,
  focusRef,
  sheetKey,
  children,
}: {
  open: boolean
  /** Вызывается и при закрытии кнопкой, Esc, тапом по фону и свайпом: владелец сам решает, можно ли закрывать. */
  onOpenChange: (open: boolean) => void
  title: string
  closeLabel: string
  describedBy: string
  focusRef: RefObject<HTMLElement | null>
  sheetKey: string
  children: ReactNode
}) {
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  const controls = useDragControls()
  const fit = useKeyboardFit(open && !desktop)

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onOpenChange(false)
  }

  const enter = desktop
    ? { initial: { opacity: 0, ...(reduce ? {} : { scale: 0.96 }) }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, ...(reduce ? {} : { scale: 0.97 }) } }
    : reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const transition = desktop || reduce ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.25, ease: EASE_DRAWER }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPortal key={sheetKey} forceMount>
            <DialogOverlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }} />
            </DialogOverlay>
            <div className={desktop ? 'pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4' : 'contents'}>
              <DialogContent
                asChild
                forceMount
                aria-describedby={describedBy}
                onOpenAutoFocus={(e) => {
                  e.preventDefault()
                  focusRef.current?.focus({ preventScroll: true })
                }}
              >
                <motion.div
                  {...enter}
                  transition={transition}
                  drag={desktop ? false : 'y'}
                  dragControls={controls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0.04, bottom: 0.7 }}
                  dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
                  onDragEnd={onDragEnd}
                  style={desktop ? undefined : { bottom: fit.bottom, maxHeight: fit.height ? fit.height - 8 : undefined }}
                  className={
                    desktop
                      ? 'glass-panel pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] flex-col rounded-3xl text-foreground'
                      : 'glass-panel fixed inset-x-0 bottom-0 flex max-h-[calc(100dvh-0.5rem)] flex-col rounded-t-3xl border-b-0 text-foreground'
                  }
                >
                  <div
                    onPointerDown={desktop ? undefined : (e) => controls.start(e)}
                    className={`shrink-0 select-none ${desktop ? '' : 'touch-none'}`}
                  >
                    {!desktop && <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-full bg-foreground/20" />}
                    <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-3">
                      <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
                      <DialogClose asChild>
                        <Button type="button" variant="ghost" size="icon-lg" aria-label={closeLabel} className="-mr-2 rounded-full">
                          <X className="size-5" />
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                  {children}
                </motion.div>
              </DialogContent>
            </div>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  )
}

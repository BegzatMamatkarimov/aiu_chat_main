import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { Globe, Loader2, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/use-auth'
import { clearGroupDraft, readGroupDraft, writeGroupDraft } from '@/features/chats/group-draft'
import {
  CreateGroupError,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  useCreateGroup,
} from '@/features/chats/use-create-group'
import { initials } from '@/features/profile/initials'
import { hueOf } from '@/lib/hue'
import { EASE_DRAWER, EASE_OUT } from '@/lib/motion'
import { useIsDesktop } from '@/lib/use-media-query'

const COUNTER_FROM = 20
const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 600

type Created = { id: string; name: string | null; isPublic: boolean; inviteCode: string }

/** Телефон: экранная клавиатура сужает видимую область, лист поднимается над ней, а «Создать» остаётся на виду. */
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

function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length
  if (left > COUNTER_FROM) return null
  return (
    <span className={`ml-auto shrink-0 tabular-nums ${left <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
      {value.length} / {max}
    </span>
  )
}

const TYPES = [
  { value: true, key: 'typePublic', Icon: Globe },
  { value: false, key: 'typePrivate', Icon: Lock },
] as const

function CreateGroupForm({
  nameRef,
  pending,
  failed,
  invalidName,
  onSubmit,
}: {
  nameRef: RefObject<HTMLInputElement | null>
  pending: boolean
  failed: boolean
  invalidName: boolean
  onSubmit: (name: string, description: string, isPublic: boolean) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [initial] = useState(() => readGroupDraft(user?.id))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [nameError, setNameError] = useState(false)
  const trimmed = name.trim()
  const showNameError = nameError || invalidName

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!trimmed) {
      setNameError(true)
      nameRef.current?.focus()
      return
    }
    onSubmit(trimmed, description.trim(), isPublic)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-auto flex-col">
      <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-5 pb-1 pt-1">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="glass-av inline-flex size-14 shrink-0 select-none items-center justify-center rounded-full text-lg font-semibold shadow-md"
            style={{ '--h': hueOf(trimmed) } as CSSProperties}
          >
            {initials(trimmed)}
          </span>
          <div className="min-w-0 flex-1">
            <Label htmlFor="group-name" className="mb-1.5">
              {t('chats.create.name')}
            </Label>
            <Input
              ref={nameRef}
              id="group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(false)
                writeGroupDraft(user?.id, e.target.value, description, isPublic)
              }}
              maxLength={GROUP_NAME_MAX}
              placeholder={t('chats.create.namePlaceholder')}
              autoComplete="off"
              enterKeyHint="go"
              aria-invalid={showNameError}
              aria-describedby="group-name-hint"
              className="h-10"
            />
          </div>
        </div>
        <div id="group-name-hint" className="flex min-h-4 gap-2 text-xs">
          {showNameError && (
            <span role="alert" className="text-destructive">
              {t('chats.create.nameRequired')}
            </span>
          )}
          <Counter value={name} max={GROUP_NAME_MAX} />
        </div>
        <div>
          <Label htmlFor="group-description" className="mb-1.5">
            {t('chats.create.description')}
          </Label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              writeGroupDraft(user?.id, name, e.target.value, isPublic)
            }}
            maxLength={GROUP_DESCRIPTION_MAX}
            rows={3}
            placeholder={t('chats.create.descriptionPlaceholder')}
            aria-describedby="group-description-hint"
          />
          <div id="group-description-hint" className="mt-1 flex min-h-4 text-xs">
            <Counter value={description} max={GROUP_DESCRIPTION_MAX} />
          </div>
        </div>
        <div role="radiogroup" aria-label={t('chats.create.typeLabel')} className="grid grid-cols-2 gap-2">
          {TYPES.map(({ value, key, Icon }) => (
            <label
              key={key}
              className="glass-press relative flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border border-foreground/10 px-3 py-2.5 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="group-type"
                checked={isPublic === value}
                onChange={() => {
                  setIsPublic(value)
                  writeGroupDraft(user?.id, name, description, value)
                }}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{t(`chats.create.${key}`)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2.5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t('chats.create.error')}
          </p>
        )}
        <DialogDescription className="text-xs">{t(isPublic ? 'chats.create.publicHint' : 'chats.create.privateHint')}</DialogDescription>
        <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
          {pending && <Loader2 className="animate-spin" />}
          {t('chats.create.submit')}
        </Button>
      </div>
    </form>
  )
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (group: Created) => void
}) {
  const { t } = useTranslation()
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  const controls = useDragControls()
  const fit = useKeyboardFit(open && !desktop)
  const nameRef = useRef<HTMLInputElement>(null)
  const create = useCreateGroup()
  const sending = useRef(false)
  const invalidName = create.error instanceof CreateGroupError && create.error.invalidName
  const failed = create.isError && !invalidName

  const change = (next: boolean) => {
    // Пока группа создаётся, окно не закрываем: иначе пользователь не увидит результат.
    if (!next && create.isPending) return
    if (!next) create.reset()
    onOpenChange(next)
  }

  const submit = (name: string, description: string, isPublic: boolean) => {
    // isPending обновляется после перерисовки, а двойной клик приходит раньше.
    if (sending.current) return
    sending.current = true
    create.mutate(
      { name, description, isPublic },
      {
        onSettled: () => {
          sending.current = false
        },
        onSuccess: (group) => {
          clearGroupDraft()
          create.reset()
          onCreated({ id: group.id, name: group.name, isPublic: group.is_public, inviteCode: group.invite_code })
        },
      },
    )
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) change(false)
  }

  const enter = desktop
    ? { initial: { opacity: 0, ...(reduce ? {} : { scale: 0.96 }) }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, ...(reduce ? {} : { scale: 0.97 }) } }
    : reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const transition = desktop || reduce ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.25, ease: EASE_DRAWER }

  return (
    <Dialog open={open} onOpenChange={change}>
      <AnimatePresence>
        {open && (
          <DialogPortal key="create-group" forceMount>
            <DialogOverlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }} />
            </DialogOverlay>
            <div className={desktop ? 'pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4' : 'contents'}>
            <DialogContent
              asChild
              forceMount
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                nameRef.current?.focus({ preventScroll: true })
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
                    <DialogTitle className="text-xl font-bold tracking-tight">{t('chats.create.title')}</DialogTitle>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost" size="icon-lg" aria-label={t('chats.create.close')} className="-mr-2 rounded-full">
                        <X className="size-5" />
                      </Button>
                    </DialogClose>
                  </div>
                </div>
                <CreateGroupForm nameRef={nameRef} pending={create.isPending} failed={failed} invalidName={invalidName} onSubmit={submit} />
              </motion.div>
            </DialogContent>
            </div>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  )
}

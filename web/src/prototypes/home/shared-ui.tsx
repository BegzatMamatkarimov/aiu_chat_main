import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pause, Play, Reply, X } from 'lucide-react'
import { PEOPLE, type Msg } from './demo-data'
import { EASE_DRAWER, EASE_OUT, REACTION_SET, hueStyle, previewOf, useIsDesktop, useIsStuck } from './shared-logic'

export function Avatar({
  label,
  hue,
  size = 44,
  kind = 'grad',
  square = false,
  className = '',
}: {
  label: string
  hue: number
  size?: number
  kind?: 'grad' | 'soft' | 'line'
  square?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`proto-av-${kind} inline-flex shrink-0 select-none items-center justify-center font-semibold ${square ? 'rounded-[28%]' : 'rounded-full'} ${className}`}
      style={{ ...hueStyle(hue), width: size, height: size, fontSize: Math.max(11, Math.round(size * (label.length > 2 ? 0.3 : 0.36))) }}
    >
      {label}
    </span>
  )
}

const URL_RE = /(https?:\/\/[^\s]+)/g

export function Linkified({ text, linkClass = 'underline underline-offset-2' }: { text: string; linkClass?: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`break-all ${linkClass}`}>
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

export function ReplyQuote({
  msg,
  className = '',
  onClick,
  onClose,
}: {
  msg: Msg
  className?: string
  onClick?: () => void
  onClose?: () => void
}) {
  const author = PEOPLE[msg.authorId]
  const body = (
    <>
      <span className="proto-name block truncate text-[0.8125rem] font-semibold leading-tight">{author.name}</span>
      <span className="block truncate text-[0.8125rem] leading-snug opacity-80">{previewOf(msg)}</span>
    </>
  )
  return (
    <div className={`flex min-w-0 items-stretch gap-2 ${className}`} style={hueStyle(author.hue)}>
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: 'oklch(0.62 0.15 var(--h))' }} />
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Отменить ответ"
          className="proto-press flex size-8 shrink-0 items-center justify-center self-center rounded-full opacity-70 hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function Reactions({
  reactions,
  onToggle,
  chip,
  chipMine,
  className = '',
}: {
  reactions: Record<string, string[]>
  onToggle: (emoji: string) => void
  chip: string
  chipMine: string
  className?: string
}) {
  const entries = Object.entries(reactions)
  if (!entries.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      <AnimatePresence initial={false}>
        {entries.map(([emoji, users]) => {
          const mine = users.includes('me')
          return (
            <motion.button
              key={emoji}
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => onToggle(emoji)}
              aria-pressed={mine}
              aria-label={`Реакция ${emoji}: ${users.length}`}
              className={`proto-press inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium ${mine ? chipMine : chip}`}
            >
              <span className="text-[0.95rem] leading-none">{emoji}</span>
              <span className="tabular-nums">{users.length}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function MessageMenu({
  open,
  mine,
  mineEmojis,
  onReact,
  onReply,
  onClose,
  topInset = 110,
}: {
  open: boolean
  mine: boolean
  mineEmojis: string[]
  onReact: (emoji: string) => void
  onReply: () => void
  onClose: () => void
  topInset?: number
}) {
  return (
    <AnimatePresence>
      {open && (
        <MenuInner
          mine={mine}
          mineEmojis={mineEmojis}
          onReact={onReact}
          onReply={onReply}
          onClose={onClose}
          topInset={topInset}
        />
      )}
    </AnimatePresence>
  )
}

function MenuInner({
  mine,
  mineEmojis,
  onReact,
  onReply,
  onClose,
  topInset,
}: Omit<Parameters<typeof MessageMenu>[0], 'open'> & { topInset: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [below, setBelow] = useState(false)

  useLayoutEffect(() => {
    const host = ref.current?.parentElement
    const scroller = host?.closest('[data-scroller]')
    if (host && scroller) setBelow(host.getBoundingClientRect().top - scroller.getBoundingClientRect().top < topInset)
  }, [topInset])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label="Действия с сообщением"
      initial={{ opacity: 0, scale: 0.9, y: below ? -4 : 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      style={{ transformOrigin: `${mine ? 'right' : 'left'} ${below ? 'top' : 'bottom'}` }}
      className={`absolute z-30 flex items-center gap-0.5 rounded-full border bg-popover p-1 text-popover-foreground shadow-xl ${mine ? 'right-0' : 'left-0'} ${below ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
    >
      {REACTION_SET.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          onClick={() => onReact(emoji)}
          aria-label={`Поставить ${emoji}`}
          className={`proto-press flex size-10 items-center justify-center rounded-full text-[1.35rem] leading-none hover:bg-muted ${mineEmojis.includes(emoji) ? 'bg-muted' : ''}`}
        >
          {emoji}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        onClick={onReply}
        className="proto-press flex h-10 items-center gap-1.5 rounded-full pl-2.5 pr-3 text-sm font-medium hover:bg-muted"
      >
        <Reply className="size-4" />
        Ответить
      </button>
    </motion.div>
  )
}

const BARS = [5, 9, 14, 8, 17, 11, 6, 15, 19, 10, 7, 13, 18, 9, 5, 12, 16, 8, 11, 17, 6, 10, 14, 7]

export function VoiceContent({ seconds, className = '' }: { seconds: number; className?: string }) {
  const [playing, setPlaying] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t + 0.1 >= seconds) {
          setPlaying(false)
          return 0
        }
        return t + 0.1
      })
    }, 100)
    return () => window.clearInterval(id)
  }, [playing, seconds])

  const progress = Math.round((tick / seconds) * BARS.length)
  const left = Math.max(0, Math.ceil(playing ? seconds - tick : seconds))
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Пауза' : 'Воспроизвести голосовое'}
        className="proto-press flex size-10 shrink-0 items-center justify-center rounded-full bg-current/15"
      >
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
      </button>
      <div className="flex h-5 items-center gap-[2px]" aria-hidden="true">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full bg-current ${i < progress ? 'opacity-100' : 'opacity-40'}`}
            style={{ height: h }}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums opacity-80">
        0:{String(left).padStart(2, '0')}
      </span>
    </div>
  )
}

export function AutoTextarea({
  value,
  onChange,
  onSend,
  placeholder,
  className = '',
  inputRef,
  maxHeight = 120,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
  className?: string
  inputRef: RefObject<HTMLTextAreaElement | null>
  maxHeight?: number
}) {
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value, inputRef, maxHeight])

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      enterKeyHint="send"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          onSend()
        }
      }}
      className={`block w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground ${className}`}
    />
  )
}

export function SplitShell({
  list,
  chat,
  isOpen,
  listWidth = 360,
}: {
  list: ReactNode
  chat: ReactNode
  isOpen: boolean
  listWidth?: number
}) {
  const desktop = useIsDesktop()
  if (desktop) {
    return (
      <div className="flex h-full min-h-0">
        <aside className="min-w-0 shrink-0 border-r" style={{ width: listWidth }}>
          {list}
        </aside>
        <main className="min-w-0 flex-1">{chat}</main>
      </div>
    )
  }
  const transition = { duration: 0.28, ease: EASE_DRAWER }
  return (
    <div className="relative h-full overflow-hidden bg-background">
      <motion.aside
        className="absolute inset-0"
        initial={false}
        animate={{ x: isOpen ? '-22%' : '0%', opacity: isOpen ? 0.5 : 1 }}
        transition={transition}
        inert={isOpen}
      >
        {list}
      </motion.aside>
      <motion.main
        className="absolute inset-0 bg-background shadow-[-12px_0_32px_rgba(0,0,0,0.12)]"
        initial={false}
        animate={{ x: isOpen ? '0%' : '100%' }}
        transition={transition}
        inert={!isOpen}
      >
        {chat}
      </motion.main>
    </div>
  )
}

export function DateChip({
  label,
  top,
  scrollerRef,
  scrolling,
  chipClass,
}: {
  label: string
  top: number
  scrollerRef: RefObject<HTMLElement | null>
  scrolling: boolean
  chipClass: string
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const stuck = useIsStuck(sentinel, scrollerRef, top)
  const visible = !stuck || scrolling
  return (
    <>
      <div ref={sentinel} className="h-0" aria-hidden="true" />
      <div className="pointer-events-none sticky z-10 flex justify-center py-2" style={{ top }}>
        <span
          className={`${chipClass} transition-opacity duration-200 ease-out motion-reduce:transition-none`}
          style={{ opacity: visible ? 1 : 0 }}
        >
          {label}
        </span>
      </div>
    </>
  )
}

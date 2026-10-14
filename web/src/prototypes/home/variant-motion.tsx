import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowUp, CheckCheck, ChevronLeft, Mic, Reply, Search, SmilePlus, Trash2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ME_ID, PEOPLE, initials, type Chat, type Msg } from './demo-data'
import {
  EASE_DRAWER,
  EASE_OUT,
  formatTime,
  hueStyle,
  listTime,
  previewLine,
  scrollToMessage,
  useBubbleGestures,
  useFocusOnReply,
  useHeight,
  useIsDesktop,
  useMediaQuery,
  useMessenger,
  useStickToBottom,
  type Messenger,
  type TimelineItem,
} from './shared-logic'
import { Avatar, AutoTextarea, Linkified, MessageMenu, Reactions, ReplyQuote, VoiceContent } from './shared-ui'

type Folder = 'all' | 'subject' | 'direct'
const FOLDERS: { id: Folder; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'subject', label: 'Предметы' },
  { id: 'direct', label: 'Личные' },
]

const chatLabel = (c: Chat) => (c.kind === 'subject' ? c.short : initials(c.title))

const ANSWERS = [
  'Хороший вопрос! На экзамене такое было, загляни в конспект по этой теме 👍',
  'Скинь, что именно не получается — разберём вместе',
  'Да, я тоже так делал. Главное — не забыть про граничные случаи',
  'Посмотри лекцию 5, там как раз пример с разбором',
]
const SENIORS = ['daniyar', 'yerlan', 'sanzhar', 'aliya']

type Typing = { chatId: string; authorId: string } | null

export function VariantMotion() {
  const mx = useMessenger()
  const [typing, setTyping] = useState<Typing>(null)
  const timers = useRef<number[]>([])
  const replies = useRef(0)
  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  const { chat, send, receive } = mx
  const onSend = (text: string, extra: Partial<Msg> = {}) => {
    if (!chat) return
    send(text, extra)
    const n = replies.current++
    const authorId = chat.kind === 'direct' && chat.peerId ? chat.peerId : SENIORS[n % SENIORS.length]
    const chatId = chat.id
    timers.current.push(
      window.setTimeout(() => setTyping({ chatId, authorId }), 350),
      window.setTimeout(() => {
        setTyping(null)
        receive(chatId, authorId, ANSWERS[n % ANSWERS.length])
      }, 1800),
    )
  }

  return (
    <div className="proto-motion h-full bg-background">
      <MotionShell
        isOpen={mx.isOpen}
        onBack={mx.back}
        list={<MotionList mx={mx} />}
        chat={<MotionChat mx={mx} typing={typing} onSend={onSend} />}
      />
    </div>
  )
}

function MotionShell({
  list,
  chat,
  isOpen,
  onBack,
}: {
  list: ReactNode
  chat: ReactNode
  isOpen: boolean
  onBack: () => void
}) {
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const x = useMotionValue(isOpen ? 0 : w)
  const controls = useDragControls()
  const listX = useTransform(x, [0, w], [-w * 0.22, 0])
  const listOpacity = useTransform(x, [0, w], [0.5, 1])

  useEffect(() => {
    if (desktop) return
    const c = animate(x, isOpen ? 0 : w, { duration: reduce ? 0 : 0.28, ease: EASE_DRAWER })
    return () => c.stop()
  }, [isOpen, w, desktop, x, reduce])

  if (desktop) {
    return (
      <div className="flex h-full min-h-0">
        <aside className="min-w-0 shrink-0 border-r" style={{ width: 360 }}>
          {list}
        </aside>
        <main className="min-w-0 flex-1">{chat}</main>
      </div>
    )
  }
  return (
    <div className="relative h-full overflow-hidden bg-background">
      <motion.aside className="absolute inset-0" style={{ x: listX, opacity: listOpacity }} inert={isOpen}>
        {list}
      </motion.aside>
      <motion.main
        className="absolute inset-0 bg-background shadow-[-12px_0_32px_rgba(0,0,0,0.12)]"
        style={{ x }}
        drag="x"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ left: 0, right: w }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x > w * 0.33 || info.velocity.x > 500) onBack()
          else animate(x, 0, { type: 'spring', duration: 0.35, bounce: 0.15 })
        }}
        inert={!isOpen}
      >
        {chat}
        {isOpen && (
          <div
            className="absolute bottom-0 left-0 top-16 z-40 w-4"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => controls.start(e)}
            aria-hidden="true"
          />
        )}
      </motion.main>
    </div>
  )
}

function UnreadCount({ n, className = '' }: { n: number; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <motion.span
          key="badge"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className={`relative inline-flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center overflow-hidden rounded-full px-1.5 text-xs font-semibold tabular-nums ${className}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={n}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="block"
            >
              {n}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function FlyAvatar({ chat, size }: { chat: Chat; size: number }) {
  return (
    <motion.span layoutId={`av-${chat.id}`} className="inline-flex shrink-0" transition={{ duration: 0.28, ease: EASE_DRAWER }}>
      <Avatar label={chatLabel(chat)} hue={chat.hue} size={size} />
    </motion.span>
  )
}

function MotionList({ mx }: { mx: Messenger }) {
  const [folder, setFolder] = useState<Folder>('all')
  const rows = mx.rows.filter(({ chat }) => folder === 'all' || chat.kind === folder)
  const unreadOf = (f: Folder) =>
    mx.allRows.reduce((sum, { chat }) => sum + (f === 'all' || chat.kind === f ? chat.unread : 0), 0)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--out-a)] to-[var(--out-b)] text-sm font-extrabold text-white">
              A
            </span>
            AIU Chat
          </h1>
          <ThemeToggle />
        </div>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-full bg-muted px-3.5 text-muted-foreground focus-within:ring-2 focus-within:ring-primary/40">
          <Search className="size-4 shrink-0" />
          <input
            value={mx.query}
            onChange={(e) => mx.setQuery(e.target.value)}
            placeholder="Поиск по чатам"
            aria-label="Поиск по чатам"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Папки" className="flex border-b px-1">
        {FOLDERS.map((f) => {
          const unread = unreadOf(f.id)
          const active = folder === f.id
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setFolder(f.id)}
              className={`relative flex h-11 flex-1 items-center justify-center gap-1.5 text-sm font-semibold transition-colors duration-150 ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f.label}
              {unread > 0 && (
                <span className="rounded-full bg-muted-foreground/20 px-1.5 text-[0.6875rem] font-semibold tabular-nums leading-5 text-muted-foreground">
                  {unread}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="motion-folder"
                  className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary"
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="proto-scroll min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]">
        {rows.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Ничего не найдено. Попробуйте другое название предмета или имя.</p>
        )}
        {rows.map(({ chat, last }) => {
          const active = mx.chat?.id === chat.id && (mx.isOpen)
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => mx.open(chat.id)}
              aria-current={active ? 'true' : undefined}
              className="proto-press relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left hover:bg-muted/70"
            >
              {active && (
                <motion.span
                  layoutId="motion-active-row"
                  className="absolute inset-0 rounded-2xl bg-primary/[0.12]"
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                />
              )}
              <span className="relative">
                <FlyAvatar chat={chat} size={52} />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.9375rem] font-semibold">{chat.title}</span>
                  {last && (
                    <span className={`shrink-0 text-xs tabular-nums ${chat.unread ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                      {listTime(last.ts)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">
                    {previewLine(chat, last)}
                  </span>
                  <UnreadCount n={chat.unread} className="bg-primary text-primary-foreground" />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MotionChat({ mx, typing, onSend }: { mx: Messenger; typing: Typing; onSend: (t: string, e?: Partial<Msg>) => void }) {
  if (!mx.chat) {
    return (
      <div className="relative flex h-full items-center justify-center bg-muted/40">
        <div className="proto-pattern pointer-events-none absolute inset-0 bg-primary/10" />
        <p className="relative rounded-full bg-background/80 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">Выберите чат, чтобы начать общение</p>
      </div>
    )
  }
  return <MotionChatBody key={mx.chat.id} mx={mx} chat={mx.chat} typing={typing?.chatId === mx.chat.id ? typing : null} onSend={onSend} />
}

const HEADER_H = 64

function MotionChatBody({ mx, chat, typing, onSend }: { mx: Messenger; chat: Chat; typing: Typing; onSend: (t: string, e?: Partial<Msg>) => void }) {
  const [initialCount] = useState(mx.chatMessages.length)
  const indexOf = new Map(mx.chatMessages.map((m, i) => [m.id, i]))
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const composerH = useHeight(composerRef)
  useStickToBottom(scrollRef, chat.id, mx.chatMessages.length + (typing ? 1 : 0), composerH)
  const subject = chat.kind === 'subject'
  const peer = chat.peerId ? PEOPLE[chat.peerId] : null
  const others = mx.totalUnread

  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-b from-primary/[0.07] to-primary/[0.02]">
      <div className="proto-pattern pointer-events-none absolute inset-0 bg-primary/[0.13]" />

      <header
        className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/70 px-2 backdrop-blur-xl md:px-4"
        style={{ height: HEADER_H }}
      >
        <button
          type="button"
          onClick={mx.back}
          aria-label="Назад к списку чатов"
          className="proto-press relative flex h-10 items-center rounded-full pr-1 text-primary md:hidden"
        >
          <ChevronLeft className="size-7" />
          {others > 0 && (
            <UnreadCount n={others} className="bg-primary text-primary-foreground" />
          )}
        </button>
        <FlyAvatar chat={chat} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">{chat.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {typing ? (
              <span className="text-primary">{PEOPLE[typing.authorId].name.split(' ')[0]} печатает…</span>
            ) : subject ? (
              `${chat.members?.toLocaleString('ru-RU')} участников`
            ) : (
              `${peer?.course} курс`
            )}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div
        ref={scrollRef}
        data-scroller
        className="proto-scroll absolute inset-0 overflow-y-auto overflow-x-hidden px-2 md:px-6"
        style={{ paddingTop: HEADER_H + 4, paddingBottom: composerH + 8 }}
      >
        <div className="mx-auto max-w-3xl">
          {mx.days.map((day) => (
            <section key={day.key}>
              <div className="sticky z-10 flex justify-center py-2" style={{ top: HEADER_H + 6 }}>
                <span className="rounded-full border border-border/50 bg-background/75 px-3 py-1 text-xs font-medium text-foreground/80 shadow-sm backdrop-blur-md">
                  {day.label}
                </span>
              </div>
              {day.items.map((item) => (
                <MotionMessage
                  key={item.msg.id}
                  item={item}
                  mx={mx}
                  subject={subject}
                  stagger={(() => {
                    const i = indexOf.get(item.msg.id) ?? 0
                    return i < initialCount && i >= initialCount - 10 ? i - (initialCount - 10) : null
                  })()}
                />
              ))}
            </section>
          ))}
          <TypingRow typing={typing} />
        </div>
      </div>

      <MotionComposer mx={mx} composerRef={composerRef} onSend={onSend} />
    </div>
  )
}

function Tail({ mine }: { mine: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="13"
      viewBox="0 0 9 13"
      className={`absolute bottom-0 ${mine ? '-right-[8px]' : '-left-[8px] -scale-x-100'}`}
      style={{ fill: mine ? 'var(--out-b)' : 'var(--in-bg)' }}
    >
      <path d="M0 0v13h9C4.5 12.5 0 8.5 0 0z" />
    </svg>
  )
}

function MotionMessage({ item, mx, subject, stagger }: { item: TimelineItem; mx: Messenger; subject: boolean; stagger: number | null }) {
  const coarse = useMediaQuery('(pointer: coarse)')
  const dragX = useMotionValue(0)
  const iconOpacity = useTransform(dragX, [8, 56], [0, 1])
  const iconScale = useTransform(dragX, [8, 56], [0.5, 1])
  const { msg, mine, first, last } = item
  const author = PEOPLE[msg.authorId]
  const reply = msg.replyTo ? mx.byId.get(msg.replyTo) : undefined
  const gestures = useBubbleGestures(
    () => mx.setMenuId(msg.id),
    () => mx.toggleReaction(msg.id, '👍'),
  )
  const mineEmojis = Object.entries(msg.reactions).filter(([, u]) => u.includes(ME_ID)).map(([e]) => e)

  const radius = mine
    ? `${first ? '' : 'rounded-tr-[6px]'} ${last ? 'rounded-br-none' : 'rounded-br-[6px]'}`
    : `${first ? '' : 'rounded-tl-[6px]'} ${last ? 'rounded-bl-none' : 'rounded-bl-[6px]'}`

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={msg.fresh ? { opacity: 0, y: 14, scale: 0.96 } : stagger !== null ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: EASE_OUT, delay: stagger !== null ? stagger * 0.035 : 0 }}
      style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
      className={`group/msg relative ${first ? 'mt-2' : 'mt-0.5'}`}
    >
      <motion.span
        aria-hidden="true"
        style={{ opacity: iconOpacity, scale: iconScale }}
        className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary/15 text-primary"
      >
        <Reply className="size-4" />
      </motion.span>
      <motion.div
        style={{ x: dragX }}
        drag={coarse ? 'x' : false}
        dragConstraints={{ left: 0, right: 96 }}
        dragElastic={0.1}
        dragSnapToOrigin
        dragDirectionLock
        dragTransition={{ bounceStiffness: 600, bounceDamping: 28 }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 56) mx.startReply(msg.id)
        }}
        className={`flex items-end gap-2 ${mine ? 'justify-end pr-2' : 'justify-start'}`}
      >
      {!mine && subject && (
        <div className="w-8 shrink-0 self-end">
          {last && <Avatar label={initials(author.name)} hue={author.hue} size={32} />}
        </div>
      )}
      <div className={`relative flex max-w-[82%] flex-col md:max-w-[68%] ${mine ? 'items-end' : 'items-start'} ${!mine && !subject ? 'ml-2' : ''}`}>
        <div
          {...gestures}
          className={`proto-bubble relative max-w-full rounded-2xl px-3 py-1.5 ${radius} ${
            mine
              ? 'bg-gradient-to-br from-[var(--out-a)] to-[var(--out-b)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
              : 'bg-[var(--in-bg)] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
          }`}
        >
          {first && !mine && subject && (
            <div className="mb-0.5 flex items-baseline gap-1.5" style={hueStyle(author.hue)}>
              <span className="proto-name truncate text-[0.8125rem] font-semibold">{author.name}</span>
              <span className="shrink-0 text-[0.6875rem] font-medium text-muted-foreground">{author.course} курс</span>
            </div>
          )}
          {reply && (
            <ReplyQuote
              msg={reply}
              onClick={() => scrollToMessage(reply.id)}
              className={`mb-1 mt-0.5 rounded-md py-1 pl-1.5 pr-2 ${mine ? 'bg-white/15 [&_.proto-name]:text-white [&>span:first-child]:bg-white/70!' : 'bg-primary/[0.07]'}`}
            />
          )}
          {msg.voice ? (
            <div className="pb-3.5 pr-1 pt-1">
              <VoiceContent seconds={msg.voice} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-[1.35]">
              <Linkified text={msg.text} linkClass={`underline underline-offset-2 ${mine ? 'text-white' : 'text-primary'}`} />
              <span className="inline-block" style={{ width: mine ? '4.6rem' : '2.9rem' }} aria-hidden="true" />
            </p>
          )}
          <span className={`absolute bottom-1 right-2.5 flex items-center gap-1 text-[0.6875rem] tabular-nums ${mine ? 'text-white/80' : 'text-muted-foreground'}`}>
            {formatTime(msg.ts)}
            {mine && <CheckCheck className="size-3.5" />}
          </span>
          {last && <Tail mine={mine} />}
        </div>

        <Reactions
          reactions={msg.reactions}
          onToggle={(e) => mx.toggleReaction(msg.id, e)}
          chip="border border-border bg-background/85 text-foreground"
          chipMine="border border-primary/40 bg-primary/15 text-primary"
          className={`mt-1 ${mine ? 'justify-end' : ''}`}
        />

        <button
          type="button"
          onClick={() => mx.setMenuId(msg.id)}
          aria-label="Реакция или ответ"
          className={`absolute top-1 flex size-8 items-center justify-center rounded-full border bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 group-hover/msg:opacity-100 [@media(hover:none)]:hidden ${mine ? '-left-10' : '-right-10'}`}
        >
          <SmilePlus className="size-4" />
        </button>

        <MessageMenu
          open={mx.menuId === msg.id}
          mine={mine}
          mineEmojis={mineEmojis}
          onReact={(e) => mx.toggleReaction(msg.id, e)}
          onReply={() => mx.startReply(msg.id)}
          onClose={() => mx.setMenuId(null)}
          topInset={HEADER_H + 70}
        />
      </div>
      </motion.div>
    </motion.div>
  )
}

function MotionComposer({ mx, composerRef, onSend }: { mx: Messenger; composerRef: RefObject<HTMLDivElement | null>; onSend: (t: string, e?: Partial<Msg>) => void }) {
  const [text, setText] = useState('')
  const [rec, setRec] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useFocusOnReply(inputRef, mx.replyTo?.id ?? null)
  const hasText = text.trim().length > 0

  const recording = rec !== null
  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => setRec((s) => (s === null ? s : s + 1)), 1000)
    return () => window.clearInterval(id)
  }, [recording])

  const send = () => {
    if (!hasText) return
    onSend(text)
    setText('')
  }
  const sendVoice = () => {
    onSend('', { voice: Math.max(rec ?? 1, 1) })
    setRec(null)
  }
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div
      ref={composerRef}
      className="absolute inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/75 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:px-4"
    >
      <div className="mx-auto max-w-3xl">
        <AnimatePresence initial={false}>
          {mx.replyTo && (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="mb-2 flex items-center gap-2 rounded-2xl bg-muted/80 py-1.5 pl-3 pr-1"
            >
              <Reply className="size-4 shrink-0 text-primary" />
              <ReplyQuote msg={mx.replyTo} className="flex-1" onClose={mx.cancelReply} />
            </motion.div>
          )}
        </AnimatePresence>

        {rec !== null ? (
          <div className="flex items-end gap-2">
            <div className="flex min-h-11 flex-1 items-center gap-3 rounded-3xl bg-muted/80 pl-1.5 pr-4">
              <button
                type="button"
                onClick={() => setRec(null)}
                aria-label="Отменить запись"
                className="proto-press flex size-9 items-center justify-center rounded-full text-destructive"
              >
                <Trash2 className="size-5" />
              </button>
              <span className="size-2.5 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden="true" />
              <span className="text-base tabular-nums" aria-live="off">{mmss(rec)}</span>
              <span className="truncate text-sm text-muted-foreground">Идёт запись…</span>
            </div>
            <button
              type="button"
              onClick={sendVoice}
              aria-label="Отправить голосовое"
              className="proto-press flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--out-a)] to-[var(--out-b)] text-white"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="min-h-11 flex-1 rounded-3xl bg-muted/80 px-4 py-[0.6875rem] focus-within:ring-2 focus-within:ring-primary/40">
              <AutoTextarea
                value={text}
                onChange={setText}
                onSend={send}
                placeholder="Сообщение"
                inputRef={inputRef}
              />
            </div>
            <button
              type="button"
              onClick={hasText ? send : () => setRec(0)}
              aria-label={hasText ? 'Отправить' : 'Записать голосовое'}
              className="proto-press relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-muted-foreground"
            >
              <span
                className="absolute inset-0 bg-gradient-to-br from-[var(--out-a)] to-[var(--out-b)] transition-opacity duration-200 ease-out"
                style={{ opacity: hasText ? 1 : 0 }}
                aria-hidden="true"
              />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={hasText ? 'send' : 'mic'}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  className={`relative flex ${hasText ? 'text-white' : ''}`}
                >
                  {hasText ? <ArrowUp className="size-5" /> : <Mic className="size-[1.375rem]" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TypingRow({ typing }: { typing: Typing }) {
  return (
    <AnimatePresence>
      {typing && (
        <motion.div
          key="typing"
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          style={{ transformOrigin: 'bottom left' }}
          className="mt-2 flex items-end gap-2"
          role="status"
          aria-label={`${PEOPLE[typing.authorId].name} печатает`}
        >
          <span className="w-8 shrink-0">
            <Avatar label={initials(PEOPLE[typing.authorId].name)} hue={PEOPLE[typing.authorId].hue} size={32} />
          </span>
          <span className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-none bg-[var(--in-bg)] px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="proto-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

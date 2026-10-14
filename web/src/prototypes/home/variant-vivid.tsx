import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, CheckCheck, ChevronLeft, Mic, Reply, Search, SmilePlus, Trash2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ME_ID, PEOPLE, initials, type Chat, type Msg } from './demo-data'
import {
  EASE_OUT,
  formatTime,
  hueStyle,
  listTime,
  previewLine,
  scrollToMessage,
  useBubbleGestures,
  useFocusOnReply,
  useHeight,
  useMessenger,
  useStickToBottom,
  type Messenger,
  type TimelineItem,
} from './shared-logic'
import { Avatar, AutoTextarea, Linkified, MessageMenu, ReplyQuote, SplitShell, VoiceContent } from './shared-ui'

type Folder = 'all' | 'subject' | 'direct'
const FOLDERS: { id: Folder; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'subject', label: 'Предметы' },
  { id: 'direct', label: 'Личные' },
]

const BURST = [0, 1, 2, 3, 4, 5, 6, 7]

function Burst({ hue }: { hue: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {BURST.map((i) => {
        const a = (i / BURST.length) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full"
            style={{ background: `oklch(0.7 0.2 ${hue + (i % 2) * 50})` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        )
      })}
    </span>
  )
}

function VividChip({
  emoji,
  users,
  afterFirst,
  hue,
  onToggle,
  chip,
  chipMine,
}: {
  hue: number
  emoji: string
  users: string[]
  afterFirst: boolean
  onToggle: () => void
  chip: string
  chipMine: string
}) {
  const mine = users.includes(ME_ID)
  const [burst, setBurst] = useState(afterFirst && mine ? 1 : 0)
  const prev = useRef(mine)
  useEffect(() => {
    if (mine && !prev.current) setBurst((b) => b + 1)
    prev.current = mine
  }, [mine])
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0.55 }}
      whileTap={{ scale: 0.9 }}
      onClick={onToggle}
      aria-pressed={mine}
      aria-label={`Реакция ${emoji}: ${users.length}`}
      className={`relative inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-bold ${mine ? chipMine : chip}`}
      style={mine ? { background: 'linear-gradient(135deg, var(--out-a), var(--out-b))' } : undefined}
    >
      <span className="text-[0.95rem] leading-none">{emoji}</span>
      <span className="tabular-nums">{users.length}</span>
      {burst > 0 && <Burst key={burst} hue={hue} />}
    </motion.button>
  )
}

function VividReactions({
  hue,
  reactions,
  onToggle,
  chip,
  chipMine,
  className = '',
}: {
  hue: number
  reactions: Record<string, string[]>
  onToggle: (emoji: string) => void
  chip: string
  chipMine: string
  className?: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(id)
  }, [])
  const entries = Object.entries(reactions)
  if (!entries.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      <AnimatePresence initial={false}>
        {entries.map(([emoji, users]) => (
          <VividChip
            key={emoji}
            emoji={emoji}
            users={users}
            afterFirst={ready}
            hue={hue}
            onToggle={() => onToggle(emoji)}
            chip={chip}
            chipMine={chipMine}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

const chatLabel = (c: Chat) => (c.kind === 'subject' ? c.short : initials(c.title))

export function VariantVivid() {
  const mx = useMessenger()
  return (
    <div className="proto-vivid h-full bg-background">
      <SplitShell isOpen={mx.isOpen} list={<VividList mx={mx} />} chat={<VividChat mx={mx} />} listWidth={360} />
    </div>
  )
}

const vividColor = (l = 0.62, c = 0.2) => `oklch(${l} ${c} var(--h))`

function RingAvatar({ chat, size = 56 }: { chat: Chat; size?: number }) {
  const box = size + 14
  const r = size / 2 + 5
  const n = Math.min(chat.unread, 6)
  const circ = 2 * Math.PI * r
  const gap = n > 1 ? 7 : 0
  const seg = (circ - n * gap) / n
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ ...hueStyle(chat.hue), width: box, height: box }}>
      {n > 0 && (
        <svg className="absolute inset-0 -rotate-90" width={box} height={box} aria-hidden="true">
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={n > 1 ? `${seg} ${gap}` : undefined}
            style={{ stroke: vividColor(0.62, 0.22) }}
          />
        </svg>
      )}
      <Avatar label={chatLabel(chat)} hue={chat.hue} size={size} />
    </span>
  )
}

function VividList({ mx }: { mx: Messenger }) {
  const [folder, setFolder] = useState<Folder>('all')
  const rows = mx.rows.filter(({ chat }) => folder === 'all' || chat.kind === folder)
  const unreadOf = (f: Folder) =>
    mx.allRows.reduce((sum, { chat }) => sum + (f === 'all' || chat.kind === f ? chat.unread : 0), 0)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span
              className="flex size-8 items-center justify-center rounded-xl text-sm font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, oklch(0.64 0.22 265), oklch(0.56 0.26 320))' }}
            >
              A
            </span>
            AIU Chat
          </h1>
          <ThemeToggle />
        </div>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-2xl bg-muted px-3.5 text-muted-foreground focus-within:ring-2 focus-within:ring-primary/50">
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

      <div role="tablist" aria-label="Папки" className="flex gap-1.5 px-3 pb-2">
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
              className={`proto-press relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors duration-150 ${active ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {active && (
                <motion.span
                  layoutId="vivid-folder"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'linear-gradient(135deg, oklch(0.6 0.23 265), oklch(0.54 0.26 305))' }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                />
              )}
              <span className="relative">{f.label}</span>
              {unread > 0 && (
                <span className={`relative rounded-full px-1.5 text-[0.6875rem] font-bold tabular-nums leading-5 ${active ? 'bg-white/25 text-white' : 'bg-primary/15 text-primary'}`}>
                  {unread}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="proto-scroll min-h-0 flex-1 overflow-y-auto px-1.5 py-1 pb-[max(env(safe-area-inset-bottom),0.375rem)]">
        {rows.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Ничего не найдено. Попробуйте другое название предмета или имя.</p>
        )}
        {rows.map(({ chat, last }) => {
          const active = mx.chat?.id === chat.id && mx.isOpen
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => mx.open(chat.id)}
              aria-current={active ? 'true' : undefined}
              className="proto-press relative mb-0.5 flex w-full items-center gap-2.5 rounded-2xl py-2 pl-3 pr-2.5 text-left"
              style={{ ...hueStyle(chat.hue), background: active ? 'oklch(0.62 0.2 var(--h) / 0.16)' : undefined }}
            >
              <span
                className="absolute bottom-3 left-0 top-3 w-1 rounded-full"
                style={{ background: vividColor(), opacity: chat.kind === 'subject' ? 1 : 0.35 }}
                aria-hidden="true"
              />
              <RingAvatar chat={chat} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.9375rem] font-bold">{chat.title}</span>
                  {last && (
                    <span
                      className={`shrink-0 text-xs tabular-nums ${chat.unread ? 'font-bold' : 'text-muted-foreground'}`}
                      style={chat.unread ? { color: vividColor(0.55, 0.22) } : undefined}
                    >
                      {listTime(last.ts)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">{previewLine(chat, last)}</span>
                  {chat.unread > 0 && (
                    <span
                      className="flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums text-white"
                      style={{ background: vividColor(0.58, 0.22) }}
                    >
                      {chat.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function VividChat({ mx }: { mx: Messenger }) {
  if (!mx.chat) {
    return (
      <div className="relative flex h-full items-center justify-center bg-muted/40">
        <div className="proto-pattern pointer-events-none absolute inset-0 bg-primary/10" />
        <p className="relative rounded-full bg-background/80 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">Выберите чат, чтобы начать общение</p>
      </div>
    )
  }
  return <VividChatBody key={mx.chat.id} mx={mx} chat={mx.chat} />
}

const HEADER_H = 64

function VividChatBody({ mx, chat }: { mx: Messenger; chat: Chat }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const composerH = useHeight(composerRef)
  useStickToBottom(scrollRef, chat.id, mx.chatMessages.length, composerH)
  const subject = chat.kind === 'subject'
  const peer = chat.peerId ? PEOPLE[chat.peerId] : null
  const others = mx.totalUnread

  return (
    <div
      className="proto-vivid-chat relative h-full overflow-hidden"
      style={{ ['--ch' as string]: chat.hue, background: 'var(--tint)' }}
    >
      <div className="proto-pattern pointer-events-none absolute inset-0" style={{ background: 'var(--pat)' }} />

      <header
        className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b-[3px] bg-background/80 px-2 backdrop-blur-xl md:px-4"
        style={{ height: HEADER_H, borderBottomColor: 'var(--out-a)' }}
      >
        <button
          type="button"
          onClick={mx.back}
          aria-label="Назад к списку чатов"
          className="proto-press relative flex h-10 items-center rounded-full pr-1 text-primary md:hidden"
        >
          <ChevronLeft className="size-7" />
          {others > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-primary-foreground tabular-nums">{others}</span>
          )}
        </button>
        <Avatar label={chatLabel(chat)} hue={chat.hue} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold leading-tight">{chat.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {subject ? `${chat.members?.toLocaleString('ru-RU')} участников` : `${peer?.course} курс`}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div
        ref={scrollRef}
        data-scroller
        className="proto-scroll absolute inset-0 overflow-y-auto px-2 md:px-6"
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
                <VividMessage key={item.msg.id} item={item} mx={mx} subject={subject} hue={chat.hue} />
              ))}
            </section>
          ))}
        </div>
      </div>

      <VividComposer mx={mx} composerRef={composerRef} />
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

function VividMessage({ item, mx, subject, hue }: { item: TimelineItem; mx: Messenger; subject: boolean; hue: number }) {
  const { msg, mine, first, last } = item
  const author = PEOPLE[msg.authorId]
  const authorHueBase = hue
  const authorHue = hue + (author.hue % 5 - 2) * 16
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
      initial={msg.fresh ? { opacity: 0, y: 14, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
      className={`group/msg flex items-end gap-2 ${mine ? 'justify-end pr-2' : 'justify-start'} ${first ? 'mt-2' : 'mt-0.5'}`}
    >
      {!mine && subject && (
        <div className="w-8 shrink-0 self-end">
          {last && <Avatar label={initials(author.name)} hue={authorHue} size={32} />}
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
            <div className="mb-0.5 flex items-baseline gap-1.5" style={hueStyle(authorHue)}>
              <span className="proto-name truncate text-[0.8125rem] font-bold">{author.name}</span>
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
              <Linkified text={msg.text} linkClass={`underline underline-offset-2 ${mine ? 'text-white' : 'proto-name'}`} />
              <span className="inline-block" style={{ width: mine ? '4.6rem' : '2.9rem' }} aria-hidden="true" />
            </p>
          )}
          <span className={`absolute bottom-1 right-2.5 flex items-center gap-1 text-[0.6875rem] tabular-nums ${mine ? 'text-white/80' : 'text-muted-foreground'}`}>
            {formatTime(msg.ts)}
            {mine && <CheckCheck className="size-3.5" />}
          </span>
          {last && <Tail mine={mine} />}
        </div>

        <VividReactions
          hue={authorHueBase}
          reactions={msg.reactions}
          onToggle={(e) => mx.toggleReaction(msg.id, e)}
          chip="border border-border bg-card text-foreground"
          chipMine="border border-transparent text-white"
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
  )
}

function VividComposer({ mx, composerRef }: { mx: Messenger; composerRef: RefObject<HTMLDivElement | null> }) {
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
    mx.send(text)
    setText('')
  }
  const sendVoice = () => {
    mx.send('', { voice: Math.max(rec ?? 1, 1) } as Partial<Msg>)
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

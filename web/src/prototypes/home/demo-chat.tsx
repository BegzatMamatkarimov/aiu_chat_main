import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUp, CheckCheck, ChevronLeft, Mic, Pause, Play } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { GlassPattern } from '@/components/glass/glass-background'
import { initials } from '@/features/profile/initials'
import { EASE_OUT } from '@/lib/motion'
import { useHeight } from '@/lib/use-height'
import { CHATS, DEMO_CHAT_META, PEOPLE, messagesFor, type DemoMsg } from './demo-data'

const URL_RE = /(https?:\/\/[^\s]+)/g
const BARS = [5, 9, 14, 8, 17, 11, 6, 15, 19, 10, 7, 13, 18, 9, 5, 12, 16, 8, 11, 17, 6, 10, 14]

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="proto-link break-all underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Voice({ seconds }: { seconds: number }) {
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
  const left = Math.ceil(playing ? seconds - tick : seconds)
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Пауза' : 'Воспроизвести голосовое'}
        className="proto-voice-btn glass-press flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
      </button>
      <div className="flex h-5 items-center gap-[2px]" aria-hidden="true">
        {BARS.map((h, i) => (
          <span key={i} className={`w-[3px] rounded-full bg-current ${i < progress ? 'opacity-100' : 'opacity-45'}`} style={{ height: h }} />
        ))}
      </div>
      <span className="text-xs tabular-nums">0:{String(left).padStart(2, '0')}</span>
    </div>
  )
}

function Time({ msg, mine }: { msg: DemoMsg; mine: boolean }) {
  return (
    <span className="proto-time float-right ml-2.5 mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] leading-none tabular-nums">
      {msg.time}
      {mine && <CheckCheck className={`size-3.5 ${msg.read ? '' : 'opacity-60'}`} />}
    </span>
  )
}

const hueStyle = (hue: number) => ({ '--h': hue }) as CSSProperties

type Item = { msg: DemoMsg; mine: boolean; first: boolean; last: boolean }

function group(messages: DemoMsg[]): Item[] {
  return messages.map((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    return {
      msg,
      mine: msg.from === 'me',
      first: !prev || prev.from !== msg.from || !!msg.day,
      last: !next || next.from !== msg.from || !!next.day,
    }
  })
}

export function DemoChat() {
  const { chatId = 'alg' } = useParams()
  const navigate = useNavigate()
  const chat = CHATS.find((c) => c.id === chatId)
  const meta = DEMO_CHAT_META[chatId] ?? { subtitle: 'в сети', group: true }
  const [sent, setSent] = useState<DemoMsg[]>([])
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const composerH = useHeight(composerRef)
  const all = [...messagesFor(chatId), ...sent]
  const byId = new Map(all.map((m) => [m.id, m]))
  const hasText = text.trim().length > 0

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatId, sent.length, composerH])

  const send = () => {
    if (!hasText) return
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setSent((s) => [...s, { id: `sent-${s.length}`, from: 'me', text: text.trim(), time, read: false }])
    setText('')
  }

  return (
    <div className="relative h-full overflow-hidden">
      <GlassPattern />
      <header className="glass-bar absolute inset-x-0 top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 px-2 pt-[env(safe-area-inset-top)] md:px-4">
        <button
          type="button"
          onClick={() => void navigate('/')}
          aria-label="Назад к списку чатов"
          className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary md:hidden"
        >
          <ChevronLeft className="size-7" />
        </button>
        <ChatAvatar chatId={chatId} label={initials(chat?.title ?? '#')} size={40} side="header" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">{chat?.title ?? 'Чат'}</h2>
          <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        data-chat-scroll=""
        className="glass-scroll absolute inset-0 overflow-y-auto px-2 md:px-6"
        style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top) + 0.25rem)', paddingBottom: composerH + 12 }}
      >
        <div className="mx-auto max-w-3xl">
          {group(all).map(({ msg, mine, first, last }, i) => {
            const author = mine ? null : PEOPLE[msg.from]
            const reply = msg.replyTo ? byId.get(msg.replyTo) : undefined
            const replyAuthor = reply && reply.from !== 'me' ? PEOPLE[reply.from] : null
            return (
              <div key={msg.id}>
                {msg.day && (
                  <div className="sticky top-1 z-10 flex justify-center py-1.5">
                    <span className="proto-chip rounded-full px-3 py-1 text-xs font-medium">{msg.day}</span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT, delay: Math.min(i, 8) * 0.025 }}
                  className={`flex items-end gap-2 ${mine ? 'justify-end pr-1' : 'justify-start'} ${first ? 'mt-2' : 'mt-0.5'}`}
                >
                  {!mine && meta.group && (
                    <div className="w-8 shrink-0 self-end">
                      {last && author && (
                        <span
                          aria-hidden="true"
                          className="glass-av flex size-8 items-center justify-center rounded-full text-[0.6875rem] font-semibold"
                          style={hueStyle(author.hue)}
                        >
                          {initials(author.name)}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    className={`proto-bubble ${mine ? 'proto-bubble-out' : 'proto-bubble-in'} max-w-[82%] rounded-2xl px-3 py-1.5 md:max-w-[68%] ${
                      mine ? (last ? 'rounded-br-md' : '') : last ? 'rounded-bl-md' : ''
                    }`}
                  >
                    {first && !mine && meta.group && author && (
                      <div className="mb-0.5 flex items-baseline gap-1.5" style={hueStyle(author.hue)}>
                        <span className="proto-name truncate text-[0.8125rem] font-semibold">{author.name}</span>
                        <span className="proto-time shrink-0 text-[0.6875rem] font-medium">{author.course} курс</span>
                      </div>
                    )}
                    {reply && (
                      <div className="proto-quote mb-1 mt-0.5 rounded-md py-1 pl-2 pr-2 text-[0.8125rem] leading-snug">
                        <span className="block truncate font-semibold">{reply.from === 'me' ? 'Вы' : replyAuthor?.name}</span>
                        <span className="line-clamp-1">{reply.text ?? 'Голосовое сообщение'}</span>
                      </div>
                    )}
                    {msg.voice ? (
                      <>
                        <Voice seconds={msg.voice} />
                        <Time msg={msg} mine={mine} />
                        <span className="clear-both block" />
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-[1.35]">
                        <Linkified text={msg.text ?? ''} />
                        <Time msg={msg} mine={mine} />
                        <span className="clear-both block" />
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            )
          })}
        </div>
      </div>

      <div ref={composerRef} className="absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:px-4">
        <form
          className="proto-composer mx-auto flex max-w-3xl items-end gap-2 rounded-[1.75rem] p-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение"
            aria-label="Сообщение"
            autoComplete="off"
            enterKeyHint="send"
            className="proto-composer-field h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <button
            type={hasText ? 'submit' : 'button'}
            aria-label={hasText ? 'Отправить' : 'Записать голосовое'}
            className={`glass-press flex size-11 shrink-0 items-center justify-center rounded-full ${hasText ? 'glass-accent' : 'text-muted-foreground'}`}
          >
            {hasText ? <ArrowUp className="size-5" /> : <Mic className="size-[1.375rem]" />}
          </button>
        </form>
      </div>
    </div>
  )
}

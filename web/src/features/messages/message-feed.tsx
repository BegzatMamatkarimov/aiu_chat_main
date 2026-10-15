import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/use-auth'
import { DayChip } from '@/features/messages/day-chip'
import { MessageRow } from '@/features/messages/message-row'
import { buildDays } from '@/features/messages/message-model'
import { useSendMessage } from '@/features/messages/send-message'
import { useChatMessages } from '@/features/messages/use-chat-messages'

/** До этого расстояния от верха подгружаются старые сообщения; от низа — прилипание к последним. */
const LOAD_OLDER_PX = 500
const STICK_PX = 32
const SHOW_DOWN_PX = 240
const SCROLLING_IDLE_MS = 1000

function Skeleton() {
  const widths = ['w-44', 'w-64', 'w-52', 'w-72', 'w-40', 'w-56']
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 pt-4">
      {widths.map((w, i) => (
        <div key={i} className={cn('flex', i % 3 === 1 ? 'justify-end' : 'justify-start')}>
          <div className={cn('h-10 max-w-[82%] animate-pulse rounded-2xl bg-foreground/10 motion-reduce:animate-none', w)} />
        </div>
      ))}
    </div>
  )
}

export function MessageFeed({ chatId, isGroup }: { chatId: string; isGroup: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const myId = user?.id
  const reduce = useReducedMotion()
  const feed = useChatMessages(chatId, myId)
  const { retry, discard } = useSendMessage(chatId)
  const { messages, loaded } = feed

  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  /** scrollTop, который мы выставили сами: событие scroll с таким положением — не прокрутка пользователя. */
  const ownTop = useRef<number | null>(null)
  const metrics = useRef({ h: 0, top: 0 })
  const initialized = useRef(false)
  const firstRef = useRef<string | null>(null)
  const lastRef = useRef<string | null>(null)
  const idleTimer = useRef<number | undefined>(undefined)
  const [showDown, setShowDown] = useState(false)
  const [slow, setSlow] = useState(false)

  const days = useMemo(() => buildDays(messages, myId), [messages, myId])
  const firstId = messages[0]?.id ?? null
  const lastId = messages.at(-1)?.id ?? null

  // Что пришло в уже открытую ленту после прошлого рендера: только такие строки анимируются (при монтировании).
  const [track, setTrack] = useState<{ last: string | null | undefined; fresh: ReadonlySet<string> }>({ last: undefined, fresh: new Set() })
  if (loaded && track.last !== lastId) {
    const start =
      track.last === undefined ? messages.length : track.last === null ? 0 : (messages.findIndex((m) => m.id === track.last) + 1 || messages.length)
    setTrack({ last: lastId, fresh: new Set(messages.slice(start).map((m) => m.id)) })
  }

  const pin = useCallback(
    (smooth = false) => {
      const el = scrollerRef.current
      if (!el) return
      stick.current = true
      if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
      else {
        el.scrollTop = el.scrollHeight
        ownTop.current = el.scrollTop
      }
    },
    [reduce],
  )

  // Скелетон — только если загрузка затянулась.
  useEffect(() => {
    if (!feed.isPending) return
    const id = window.setTimeout(() => setSlow(true), 200)
    return () => window.clearTimeout(id)
  }, [feed.isPending])

  // Положение прокрутки: открытие — вниз; новое своё или при прилипании — вниз; подгрузка старых — без прыжка.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (!initialized.current) {
      if (!loaded) return
      initialized.current = true
      firstRef.current = firstId
      lastRef.current = lastId
      pin()
    } else {
      const prevFirst = firstRef.current
      const prevTail = lastRef.current
      firstRef.current = firstId
      lastRef.current = lastId
      if (prevFirst && firstId !== prevFirst && messages.some((m) => m.id === prevFirst)) {
        el.scrollTop = metrics.current.top + (el.scrollHeight - metrics.current.h)
        ownTop.current = el.scrollTop
      } else if (lastId !== prevTail) {
        const tail = messages.at(-1)
        if (stick.current || tail?.senderId === myId) pin()
      }
    }
    metrics.current = { h: el.scrollHeight, top: el.scrollTop }
  }, [loaded, messages, firstId, lastId, myId, pin])

  const loadOlder = () => {
    const el = scrollerRef.current
    if (!el || !initialized.current) return
    if (el.scrollTop < LOAD_OLDER_PX && feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) {
      void feed.fetchNextPage()
    }
  }
  const loadOlderRef = useRef(loadOlder)
  useLayoutEffect(() => {
    loadOlderRef.current = loadOlder
  })
  // Короткая лента могла не заполнить экран: догружаем, пока есть что.
  useEffect(() => {
    loadOlderRef.current()
  }, [messages, feed.hasNextPage, feed.isFetchingNextPage])

  useEffect(() => {
    const el = scrollerRef.current
    const content = contentRef.current
    if (!el || !content) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      stick.current = dist < STICK_PX
      setShowDown(dist > SHOW_DOWN_PX)
      metrics.current = { h: el.scrollHeight, top: el.scrollTop }
      if (ownTop.current !== null && Math.abs(el.scrollTop - ownTop.current) < 1) {
        ownTop.current = null
      } else {
        ownTop.current = null
        el.dataset.scrolling = 'true'
        window.clearTimeout(idleTimer.current)
        idleTimer.current = window.setTimeout(() => delete el.dataset.scrolling, SCROLLING_IDLE_MS)
      }
      loadOlderRef.current()
    }
    // Размер ленты или самого окна изменился (новые строки, рост поля ввода, клавиатура): внизу — остаёмся внизу.
    const ro = new ResizeObserver(() => {
      if (!stick.current || !initialized.current) return
      el.scrollTop = el.scrollHeight
      ownTop.current = el.scrollTop
    })
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(content)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.clearTimeout(idleTimer.current)
    }
  }, [])

  const empty = loaded && messages.length === 0

  return (
    <div className="absolute inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))]">
      <div
        ref={scrollerRef}
        role="log"
        tabIndex={0}
        aria-label={t('chat.feed.label')}
        className="glass-scroll glass-feed absolute inset-0 overflow-y-auto px-2 outline-none md:px-6"
      >
        <div
          ref={contentRef}
          className={cn(
            'mx-auto max-w-3xl pb-[calc(var(--composer-h,4.5rem)+0.75rem)]',
            // Лента ещё не загружена, а свои сообщения уже есть: прижимаем их к полю ввода.
            !loaded && messages.length > 0 && 'flex min-h-full flex-col justify-end',
          )}
        >
          <div className="flex h-8 items-center justify-center text-xs text-muted-foreground" aria-live="polite">
            {feed.isFetchingNextPage && <span>{t('common.loading')}</span>}
            {feed.isFetchNextPageError && (
              <button type="button" onClick={() => void feed.fetchNextPage()} className="glass-press rounded-full px-3 py-1 font-semibold text-primary">
                {t('chat.feed.olderError')} · {t('chats.retry')}
              </button>
            )}
          </div>
          {feed.isPending && slow && <Skeleton />}
          {days.map((day) => (
            <section key={day.key}>
              <DayChip ts={day.ts} scrollerRef={scrollerRef} />
              {day.rows.map((row) => (
                <MessageRow
                  key={row.msg.id}
                  msg={row.msg}
                  mine={row.mine}
                  first={row.first}
                  last={row.last}
                  group={isGroup}
                  fresh={track.fresh.has(row.msg.id)}
                  onRetry={retry}
                  onDiscard={discard}
                />
              ))}
            </section>
          ))}
        </div>
      </div>

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 pb-[var(--composer-h,4.5rem)]">
          <p className="glass-pill rounded-full px-4 py-1.5 text-center text-sm text-muted-foreground">{t('chat.feed.empty')}</p>
        </div>
      )}

      {feed.isError && (
        <div
          className={cn(
            'flex flex-col items-center gap-3 px-6 text-center',
            messages.length > 0
              ? 'glass-pill absolute inset-x-3 top-3 z-10 rounded-2xl py-3 md:mx-auto md:max-w-sm'
              : 'absolute inset-0 justify-center pb-[var(--composer-h,4.5rem)]',
          )}
        >
          <p className="text-base font-semibold">{t('chat.feed.loadError')}</p>
          <Button type="button" variant="secondary" onClick={() => void feed.refetch()}>
            {t('chats.retry')}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => pin(true)}
        aria-label={t('chat.feed.scrollDown')}
        tabIndex={showDown ? 0 : -1}
        aria-hidden={!showDown}
        className={cn(
          'glass-pill glass-press absolute right-3 z-10 flex size-11 items-center justify-center rounded-full text-foreground shadow-lg transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none md:right-6',
          showDown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
        style={{ bottom: 'calc(var(--composer-h, 4.5rem) + 0.75rem)' }}
      >
        <ChevronDown className="size-6" />
      </button>
    </div>
  )
}

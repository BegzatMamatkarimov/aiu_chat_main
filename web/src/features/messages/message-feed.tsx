import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Copy, CornerUpLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/glass/confirm-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { markChatRead, setReadActive } from '@/features/chats/mark-read'
import { useMyChats } from '@/features/chats/use-my-chats'
import { copyText } from '@/features/messages/copy-text'
import { DayChip } from '@/features/messages/day-chip'
import { useDeleteMessage } from '@/features/messages/delete-message'
import { MessageMenu, type MenuItem, type MenuVia } from '@/features/messages/message-menu'
import { useToggleReaction } from '@/features/messages/reactions'
import { focusComposer, setReplyTarget } from '@/features/messages/reply-store'
import { useMessageTouch } from '@/features/messages/use-message-touch'
import { MessageRow } from '@/features/messages/message-row'
import { authorLabel, buildDays, type ChatMessage } from '@/features/messages/message-model'
import { useSendMessage } from '@/features/messages/send-message'
import { useChatMessages } from '@/features/messages/use-chat-messages'

/** До этого расстояния от верха подгружаются старые сообщения; от низа — прилипание к последним. */
const LOAD_OLDER_PX = 500
const STICK_PX = 32
const SHOW_DOWN_PX = 240
const SCROLLING_IDLE_MS = 1000
/** Сколько старых страниц догружаем, пока ищем сообщение из цитаты. */
const MAX_JUMP_PAGES = 10
const FLASH_MS = 1400

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
/** Ждёт конца плавной прокрутки: положение не меняется несколько кадров подряд (с запасным потолком по времени). */
const scrollSettled = (el: HTMLElement) =>
  new Promise<void>((resolve) => {
    let last = el.scrollTop
    let still = 0
    let ticks = 0
    const tick = () => {
      ticks += 1
      still = Math.abs(el.scrollTop - last) < 0.5 ? still + 1 : 0
      last = el.scrollTop
      if (still >= 4 || ticks > 180) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
const frames = (n: number) =>
  new Promise<void>((r) => {
    const tick = (left: number) => (left <= 0 ? r() : requestAnimationFrame(() => tick(left - 1)))
    tick(n)
  })

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
  const toggleReaction = useToggleReaction(chatId)
  const deleteMessage = useDeleteMessage(chatId)
  const myChats = useMyChats()
  const qc = useQueryClient()
  const isAdmin = isGroup && myChats.data?.find((c) => c.id === chatId)?.role === 'admin'
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

  // Разделитель «Непрочитанные»: счётчик фиксируется один раз при открытии, до mark_read; перед N-м с конца чужим сообщением.
  const [divider, setDivider] = useState<{ id: string | null } | null>(null)
  if (divider === null && loaded && (myChats.data || myChats.isError)) {
    const unread = myChats.data?.find((c) => c.id === chatId)?.unread ?? 0
    const others = messages.filter((m) => m.senderId !== myId && m.status === 'sent')
    setDivider({ id: unread > 0 && others.length > 0 ? others[Math.max(0, others.length - unread)].id : null })
  }
  const dividerId = divider?.id ?? null
  const ready = divider !== null

  // Отметка «прочитано»: при открытии, при возврате во вкладку (новые входящие обрабатывает realtime).
  useEffect(() => {
    if (!ready) return
    setReadActive(chatId, true)
    const run = () => markChatRead(qc, chatId)
    run()
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
      setReadActive(chatId, false)
    }
  }, [qc, chatId, ready])

  // ---------- Меню сообщения, ответ, переход к цитате ----------
  type MenuState = { id: string; bubble: HTMLElement; scroller: HTMLElement; via: MenuVia }
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<{ msg: ChatMessage; open: boolean } | null>(null)
  const latest = useRef({ messages, feed, myId, isAdmin })
  useLayoutEffect(() => {
    latest.current = { messages, feed, myId, isAdmin }
  })
  const findMessage = useCallback((id: string) => latest.current.messages.find((m) => m.id === id), [])

  const openMenu = useCallback((id: string, bubble: HTMLElement, via: MenuVia) => {
    const msg = latest.current.messages.find((m) => m.id === id)
    const scroller = scrollerRef.current
    if (!msg || msg.deleted || !scroller) return
    setMenu((cur) => (cur && cur.id === id ? cur : { id, bubble, scroller, via }))
  }, [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const startReply = useCallback(
    (msg: ChatMessage) => {
      if (msg.deleted || msg.status !== 'sent') return
      setReplyTarget(chatId, { id: msg.id, authorName: authorLabel(msg.author, ''), body: msg.body, deleted: false })
      focusComposer(chatId)
    },
    [chatId],
  )

  useMessageTouch(scrollerRef, {
    reduce: !!reduce,
    canMenu: (id) => {
      const m = findMessage(id)
      return !!m && !m.deleted
    },
    canReply: (id) => {
      const m = findMessage(id)
      return !!m && !m.deleted && m.status === 'sent'
    },
    onLongPress: (id, bubble) => openMenu(id, bubble, 'hold'),
    onReply: (id) => {
      const m = findMessage(id)
      if (m) startReply(m)
    },
  })

  const flash = useCallback((id: string) => {
    const bubble = document.getElementById(`msg-${id}`)?.querySelector<HTMLElement>('[data-bubble]')
    if (!bubble) return
    bubble.classList.remove('glass-flash')
    void bubble.offsetWidth
    bubble.classList.add('glass-flash')
    window.setTimeout(() => bubble.classList.remove('glass-flash'), FLASH_MS)
  }, [])

  /** Прокручивает ленту так, чтобы сообщение было по центру, и подсвечивает его; false, если строки нет в DOM. */
  const revealMessage = useCallback(
    async (id: string) => {
      const sc = scrollerRef.current
      if (!sc) return false
      const centered = () => {
        const row = document.getElementById(`msg-${id}`)
        if (!row || !sc.contains(row)) return null
        const rr = row.getBoundingClientRect()
        const sr = sc.getBoundingClientRect()
        const top = sc.scrollTop + (rr.top - sr.top) - (sr.height - rr.height) / 2
        return Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, top))
      }
      const first = centered()
      if (first === null) return false
      if (Math.abs(first - sc.scrollTop) > 1) {
        sc.scrollTo({ top: first, behavior: reduce ? 'auto' : 'smooth' })
        if (!reduce) await scrollSettled(sc)
        // Пока лента ехала, сверху могли подгрузиться страницы: доводим до центра без анимации.
        const again = centered()
        if (again !== null && Math.abs(again - sc.scrollTop) > 24) {
          sc.scrollTo({ top: again, behavior: 'auto' })
          await frames(2)
        }
      }
      flash(id)
      return true
    },
    [flash, reduce],
  )

  const jumping = useRef(false)
  const jumpTo = useCallback(
    async (id: string) => {
      if (jumping.current) return
      jumping.current = true
      try {
        let more = true
        let fetched = 0
        for (let waits = 0; waits < 60; waits++) {
          if (await revealMessage(id)) return
          const f = latest.current.feed
          if (f.isFetchingNextPage) {
            await sleep(80)
            continue
          }
          if (!more || !f.hasNextPage || fetched >= MAX_JUMP_PAGES) break
          fetched += 1
          const res = await f.fetchNextPage({ cancelRefetch: false })
          if (res.isError) {
            toast.error(t('chat.feed.olderError'))
            return
          }
          more = res.hasNextPage
          await frames(2)
        }
        if (await revealMessage(id)) return
        toast(t('chat.feed.tooOld'))
      } finally {
        jumping.current = false
      }
    },
    [revealMessage, t],
  )

  const react = useCallback((id: string, emoji: string) => void toggleReaction(id, emoji), [toggleReaction])

  const menuMsg = menu ? messages.find((m) => m.id === menu.id) : undefined

  const canDelete = (m: ChatMessage) => m.status === 'sent' && !m.deleted && (m.senderId === myId || isAdmin)

  const menuItems = (m: ChatMessage): MenuItem[] => {
    const close = () => setMenu(null)
    const items: MenuItem[] = []
    if (m.status === 'sent') {
      items.push({
        key: 'reply',
        label: t('chat.msgMenu.reply'),
        icon: <CornerUpLeft className="size-[18px]" />,
        run: () => {
          startReply(m)
          close()
        },
      })
    }
    if (m.body) {
      items.push({
        key: 'copy',
        label: t('chat.msgMenu.copy'),
        icon: <Copy className="size-[18px]" />,
        run: () => {
          close()
          void copyText(m.body ?? '').then((ok) => (ok ? toast.success(t('chat.msgMenu.copied')) : toast.error(t('chat.msgMenu.copyError'))))
        },
      })
    }
    if (m.status === 'failed') {
      items.push({
        key: 'retry',
        label: t('chat.status.retry'),
        icon: <RotateCcw className="size-[18px]" />,
        run: () => {
          close()
          retry(m.id)
        },
      })
      items.push({
        key: 'discard',
        label: t('chat.status.discard'),
        icon: <Trash2 className="size-[18px]" />,
        danger: true,
        run: () => {
          close()
          discard(m.id)
        },
      })
    }
    if (canDelete(m)) {
      items.push({
        key: 'delete',
        label: t('chat.msgMenu.delete'),
        icon: <Trash2 className="size-[18px]" />,
        danger: true,
        run: () => {
          // Фокус возвращается на пузырь до открытия окна, чтобы окно вернуло его туда же при закрытии.
          document.getElementById(`msg-${m.id}`)?.querySelector<HTMLElement>('[data-bubble]')?.focus({ preventScroll: true })
          close()
          setConfirm({ msg: m, open: true })
        },
      })
    }
    return items
  }

  const confirmOther = !!confirm && confirm.msg.senderId !== myId

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
      if (!loaded || !ready) return
      initialized.current = true
      firstRef.current = firstId
      lastRef.current = lastId
      const mark = dividerId ? document.getElementById('unread-divider') : null
      if (mark && el.scrollHeight - (mark.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop) > el.clientHeight) {
        stick.current = false
        el.scrollTop = mark.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 40
        ownTop.current = el.scrollTop
      } else pin()
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
  }, [loaded, ready, dividerId, messages, firstId, lastId, myId, pin])

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
        className="glass-scroll glass-feed absolute inset-0 overflow-y-auto overflow-x-hidden px-2 outline-none md:px-6"
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
                <Fragment key={row.msg.id}>
                {row.msg.id === dividerId && (
                  <div id="unread-divider" className="my-2 flex justify-center">
                    <span className="glass-pill rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">{t('chat.feed.unread')}</span>
                  </div>
                )}
                <MessageRow
                  msg={row.msg}
                  mine={row.mine}
                  first={row.first}
                  last={row.last}
                  group={isGroup}
                  fresh={track.fresh.has(row.msg.id)}
                  onRetry={retry}
                  onDiscard={discard}
                  onMenu={openMenu}
                  onJump={jumpTo}
                  onReact={react}
                />
                </Fragment>
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
      {menu && menuMsg && !menuMsg.deleted && (
        <MessageMenu
          anchor={menu.bubble}
          scroller={menu.scroller}
          mine={menuMsg.senderId === myId}
          via={menu.via}
          myReactions={menuMsg.status === 'sent' ? new Set(menuMsg.reactions.filter((r) => r.mine).map((r) => r.emoji)) : null}
          items={menuItems(menuMsg)}
          onReact={(emoji) => {
            menu.bubble.focus({ preventScroll: true })
            closeMenu()
            react(menuMsg.id, emoji)
          }}
          onClose={closeMenu}
        />
      )}

      <ConfirmDialog
        open={!!confirm?.open}
        onOpenChange={(open) => setConfirm((c) => (c ? { ...c, open } : c))}
        title={
          confirm && confirmOther
            ? t('chat.delete.titleOther', { name: authorLabel(confirm.msg.author, t('chat.feed.unknownAuthor')) })
            : t('chat.delete.title')
        }
        body={t('chat.delete.body')}
        cancelLabel={t('chat.delete.cancel')}
        confirmLabel={t('chat.delete.confirm')}
        pending={false}
        onConfirm={() => {
          if (!confirm) return
          const id = confirm.msg.id
          setConfirm({ ...confirm, open: false })
          void deleteMessage(id)
        }}
      />
    </div>
  )
}

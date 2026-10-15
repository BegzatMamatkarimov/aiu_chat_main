import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleAlert, Clock, CornerUpLeft, Ellipsis, File as FileIcon, Image as ImageIcon, Mic, Video } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { cn } from '@/lib/utils'
import { hueOf } from '@/lib/hue'
import { useCourseLabel } from '@/features/profile/course'
import { initials } from '@/features/profile/initials'
import { Linkified } from '@/features/messages/linkify'
import type { MenuVia } from '@/features/messages/message-menu'
import { authorLabel, formatMessageTime, type AttachmentKind, type ChatMessage, type MessageReaction } from '@/features/messages/message-model'

const KIND_ICON = { image: ImageIcon, video: Video, audio: Mic, file: FileIcon } satisfies Record<AttachmentKind, unknown>

function Tail({ mine }: { mine: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="13"
      viewBox="0 0 9 13"
      className={cn('absolute bottom-0', mine ? '-right-[8px]' : '-left-[8px] -scale-x-100')}
      style={{ fill: mine ? 'var(--out-b)' : 'var(--in-bg)' }}
    >
      <path d="M0 0v13h9C4.5 12.5 0 8.5 0 0z" />
    </svg>
  )
}

function ReactionChip({
  reaction,
  interactive,
  onToggle,
}: {
  reaction: MessageReaction
  interactive: boolean
  onToggle: (emoji: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const first = useRef(true)
  const { count, mine, emoji } = reaction
  useEffect(() => {
    const isFirst = first.current
    first.current = false
    // Чип в строке, которая уже была на экране, «выскакивает» и при появлении; при загрузке ленты — нет.
    if (isFirst && !ref.current?.closest<HTMLElement>('[data-msg-row]')?.dataset.settled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    ref.current?.animate(
      [{ transform: 'scale(0.8)' }, { transform: 'scale(1.1)', offset: 0.55 }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    )
  }, [count, mine])
  return (
    <button
      ref={ref}
      type="button"
      disabled={!interactive}
      aria-pressed={mine}
      aria-label={`${emoji} ${count}`}
      onClick={() => onToggle(emoji)}
      className={cn(
        'glass-chip glass-press inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium disabled:opacity-100',
        mine && 'glass-chip-mine',
      )}
    >
      <span className="text-[0.95rem] leading-none">{emoji}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

type Props = {
  msg: ChatMessage
  mine: boolean
  first: boolean
  last: boolean
  /** Групповой чат: имена, курс и аватары авторов. */
  group: boolean
  /** Сообщение пришло в уже открытую ленту: проиграть анимацию появления (только при монтировании). */
  fresh: boolean
  onRetry: (id: string) => void
  onDiscard: (id: string) => void
  /** Открыть меню сообщения у этого пузыря. */
  onMenu: (id: string, bubble: HTMLElement, via: MenuVia) => void
  onJump: (id: string) => void
  onReact: (id: string, emoji: string) => void
}

export const MessageRow = memo(function MessageRow({ msg, mine, first, last, group, fresh, onRetry, onDiscard, onMenu, onJump, onReact }: Props) {
  const { t, i18n } = useTranslation()
  const courseLabel = useCourseLabel()
  const [enter] = useState(fresh)
  const lang = i18n.language
  const authorName = authorLabel(msg.author, t('chat.feed.unknownAuthor'))
  const hueKey = msg.senderId ?? msg.id
  const showAuthor = group && !mine
  const failed = msg.status === 'failed'

  const radius = mine
    ? cn(!first && 'rounded-tr-[6px]', last ? 'rounded-br-none' : 'rounded-br-[6px]')
    : cn(!first && 'rounded-tl-[6px]', last ? 'rounded-bl-none' : 'rounded-bl-[6px]')

  const StatusIcon = msg.status === 'sending' ? Clock : Check
  const bubbleRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (rowRef.current) rowRef.current.dataset.settled = '1'
  }, [])
  const interactive = msg.status === 'sent' && !msg.deleted

  const openMenu = (via: MenuVia) => {
    if (msg.deleted || !bubbleRef.current) return
    onMenu(msg.id, bubbleRef.current, via)
  }
  const onContextMenu = (e: MouseEvent) => {
    if (msg.deleted) return
    e.preventDefault()
    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch'
    openMenu(touch ? 'hold' : 'mouse')
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      openMenu('key')
    }
  }

  return (
    <div
      id={`msg-${msg.id}`}
      ref={rowRef}
      data-msg-row=""
      className={cn(
        'relative',
        first ? 'mt-2' : 'mt-0.5',
        enter && (mine ? 'glass-msg-in-out' : 'glass-msg-in-in'),
      )}
    >
      {interactive && (
        <span
          aria-hidden="true"
          className="glass-swipe-icon glass-accent absolute left-3 top-1/2 flex size-8 items-center justify-center rounded-full shadow-md"
        >
          <CornerUpLeft className="size-[1.125rem]" />
        </span>
      )}
      <div className={cn('glass-swipe flex flex-col', mine ? 'items-end' : 'items-start')}>
        <div className="glass-msg-wrap flex max-w-[86%] items-end gap-2 md:max-w-[72%]">
          {showAuthor && (
            <div className="w-8 shrink-0 self-end">
              {last && <ChatAvatar chatId={hueKey} label={initials(authorName)} src={msg.author?.avatarUrl} size={32} side="list" />}
            </div>
          )}
          {failed && <CircleAlert role="img" aria-label={t('chat.status.failed')} className="order-first mb-2 size-5 shrink-0 text-destructive" />}
          <div className="relative min-w-0">
            <div
              ref={bubbleRef}
              data-bubble=""
              data-msg-id={msg.id}
              tabIndex={msg.deleted ? undefined : 0}
              aria-haspopup={msg.deleted ? undefined : 'menu'}
              onContextMenu={onContextMenu}
              onKeyDown={onKeyDown}
              className={cn(
                'glass-bubble min-w-0 rounded-2xl px-3 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
                mine ? 'glass-bubble-out' : 'glass-bubble-in',
                radius,
              )}
            >
              {first && showAuthor && (
                <div className="mb-0.5 flex min-w-0 items-baseline gap-1.5" style={{ '--h': hueOf(hueKey) } as CSSProperties}>
                  <span className="glass-name truncate text-[0.8125rem] font-semibold">{authorName}</span>
                  {courseLabel(msg.author?.course) && (
                    <span className="shrink-0 text-[0.6875rem] font-medium text-muted-foreground">{courseLabel(msg.author?.course)}</span>
                  )}
                </div>
              )}

              {msg.reply && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t('chat.reply.jump')}
                  onClick={() => msg.reply && onJump(msg.reply.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && msg.reply) {
                      e.preventDefault()
                      e.stopPropagation()
                      onJump(msg.reply.id)
                    }
                  }}
                  className="glass-quote glass-press mb-1 mt-0.5 min-w-0 cursor-pointer rounded-md py-1 pl-2 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span className="glass-quote-name block truncate text-[0.8125rem] font-semibold leading-tight">
                    {msg.reply.authorName || t('chat.feed.unknownAuthor')}
                  </span>
                  <span className="block truncate text-[0.8125rem] leading-snug opacity-80">
                    {msg.reply.deleted ? t('chats.preview.deleted') : msg.reply.body || t('chat.feed.attachment')}
                  </span>
                </div>
              )}

              {msg.attachments.map((a) => {
                const Icon = KIND_ICON[a.kind]
                return (
                  <div key={a.id} className="mb-1 mt-0.5 flex items-center gap-2 rounded-lg bg-current/10 px-2.5 py-1.5 text-sm">
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{t(`chats.preview.${a.kind}`)}</span>
                  </div>
                )
              })}

              {msg.deleted ? (
                <p className="text-[0.9375rem] italic leading-[1.35] opacity-70">
                  {t('chats.preview.deleted')}
                  <span className="inline-block" style={{ width: mine ? '3.2rem' : '2.9rem' }} aria-hidden="true" />
                </p>
              ) : msg.body ? (
                <p className="whitespace-pre-wrap text-[0.9375rem] leading-[1.35] [overflow-wrap:anywhere]">
                  <Linkified text={msg.body} />
                  <span className="inline-block" style={{ width: mine ? '4.4rem' : '2.9rem' }} aria-hidden="true" />
                </p>
              ) : (
                <div className="h-4" aria-hidden="true" />
              )}

              <span className="glass-time absolute bottom-1 right-2.5 flex items-center gap-1 text-[0.6875rem] tabular-nums leading-none">
                {formatMessageTime(msg.createdAt, lang)}
                {mine && !failed && (
                  <>
                    <StatusIcon aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{t(`chat.status.${msg.status}`)}</span>
                  </>
                )}
              </span>
              {last && <Tail mine={mine} />}
            </div>
            {!msg.deleted && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={t('chat.msgMenu.more')}
                onClick={() => openMenu('mouse')}
                className={cn(
                  'glass-msg-more glass-pill glass-press absolute top-1/2 size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground',
                  mine ? '-left-10' : '-right-10',
                )}
              >
                <Ellipsis className="size-[1.125rem]" />
              </button>
            )}
          </div>
        </div>

        <div className={cn('flex max-w-[86%] flex-col md:max-w-[72%]', mine ? 'items-end' : 'items-start', showAuthor && 'pl-10')}>
          {msg.reactions.length > 0 && (
            <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
              {msg.reactions.map((r) => (
                <ReactionChip
                  key={r.emoji}
                  reaction={r}
                  interactive={interactive}
                  onToggle={(emoji) => onReact(msg.id, emoji)}
                />
              ))}
            </div>
          )}

          {failed && (
            <div className="mt-1 flex flex-wrap items-center justify-end gap-x-1 text-xs">
              <span className="text-destructive">{t('chat.status.failed')}</span>
              <button
                type="button"
                onClick={() => onRetry(msg.id)}
                className="glass-press inline-flex h-9 items-center rounded-full px-2.5 font-semibold text-primary"
              >
                {t('chat.status.retry')}
              </button>
              <button
                type="button"
                onClick={() => onDiscard(msg.id)}
                className="glass-press inline-flex h-9 items-center rounded-full px-2.5 font-semibold text-muted-foreground"
              >
                {t('chat.status.discard')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

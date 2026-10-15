import { memo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleAlert, Clock, File as FileIcon, Image as ImageIcon, Mic, Video } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { cn } from '@/lib/utils'
import { hueOf } from '@/lib/hue'
import { useCourseLabel } from '@/features/profile/course'
import { initials } from '@/features/profile/initials'
import { Linkified } from '@/features/messages/linkify'
import { formatMessageTime, type AttachmentKind, type ChatMessage } from '@/features/messages/message-model'

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
}

export const MessageRow = memo(function MessageRow({ msg, mine, first, last, group, fresh, onRetry, onDiscard }: Props) {
  const { t, i18n } = useTranslation()
  const courseLabel = useCourseLabel()
  const [enter] = useState(fresh)
  const lang = i18n.language
  const authorName = msg.author?.displayName || (msg.author?.username ? `@${msg.author.username}` : '') || t('chat.feed.unknownAuthor')
  const hueKey = msg.senderId ?? msg.id
  const showAuthor = group && !mine
  const failed = msg.status === 'failed'

  const radius = mine
    ? cn(!first && 'rounded-tr-[6px]', last ? 'rounded-br-none' : 'rounded-br-[6px]')
    : cn(!first && 'rounded-tl-[6px]', last ? 'rounded-bl-none' : 'rounded-bl-[6px]')

  const StatusIcon = msg.status === 'sending' ? Clock : Check

  return (
    <div
      id={`msg-${msg.id}`}
      className={cn(
        'flex flex-col',
        mine ? 'items-end' : 'items-start',
        first ? 'mt-2' : 'mt-0.5',
        enter && (mine ? 'glass-msg-in-out' : 'glass-msg-in-in'),
      )}
    >
      <div className="flex max-w-[86%] items-end gap-2 md:max-w-[72%]">
        {showAuthor && (
          <div className="w-8 shrink-0 self-end">
            {last && <ChatAvatar chatId={hueKey} label={initials(authorName)} src={msg.author?.avatarUrl} size={32} side="list" />}
          </div>
        )}
        {failed && <CircleAlert role="img" aria-label={t('chat.status.failed')} className="order-first mb-2 size-5 shrink-0 text-destructive" />}
        <div className={cn('glass-bubble min-w-0 rounded-2xl px-3 py-1.5', mine ? 'glass-bubble-out' : 'glass-bubble-in', radius)}>
          {first && showAuthor && (
            <div className="mb-0.5 flex min-w-0 items-baseline gap-1.5" style={{ '--h': hueOf(hueKey) } as CSSProperties}>
              <span className="glass-name truncate text-[0.8125rem] font-semibold">{authorName}</span>
              {courseLabel(msg.author?.course) && (
                <span className="shrink-0 text-[0.6875rem] font-medium text-muted-foreground">{courseLabel(msg.author?.course)}</span>
              )}
            </div>
          )}

          {msg.reply && (
            <div className="glass-quote mb-1 mt-0.5 min-w-0 rounded-md py-1 pl-2 pr-2">
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
      </div>

      <div className={cn('flex max-w-[86%] flex-col md:max-w-[72%]', mine ? 'items-end' : 'items-start', showAuthor && 'pl-10')}>
        {msg.reactions.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
            {msg.reactions.map((r) => (
              <span
                key={r.emoji}
                role="img"
                aria-label={`${r.emoji} ${r.count}`}
                className={cn('glass-chip inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.8125rem] font-medium', r.mine && 'glass-chip-mine')}
              >
                <span className="text-[0.95rem] leading-none">{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </span>
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
  )
})

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, CornerUpLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/use-auth'
import { getDraft, setDraft } from '@/features/messages/drafts'
import { clearReply, getReplyTarget, registerComposer, useReplyTarget } from '@/features/messages/reply-store'
import { MAX_BODY, useSendMessage } from '@/features/messages/send-message'

/** 6 строк по 24px (leading-6). */
const MAX_HEIGHT = 144
const SHOW_COUNTER_AT = 200

export function Composer({ chatId }: { chatId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { send } = useSendMessage(chatId)
  const [text, setText] = useState(() => getDraft(uid, chatId))
  const area = useRef<HTMLTextAreaElement>(null)
  const reply = useReplyTarget(chatId)

  const canSend = text.trim().length > 0 && text.length <= MAX_BODY
  const remaining = MAX_BODY - text.length

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [text])

  // С мышью и клавиатурой сразу можно печатать; на телефоне фокус не берём, чтобы не поднимать клавиатуру.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) area.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    registerComposer(chatId, area.current)
    return () => registerComposer(chatId, null)
  }, [chatId])

  const change = (value: string) => {
    setText(value)
    setDraft(uid, chatId, value)
  }

  const submit = () => {
    if (!canSend) return
    if (!send(text, getReplyTarget(chatId))) return
    clearReply(chatId)
    change('')
    area.current?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    // Enter отправляет только на устройствах с мышью/клавиатурой; на сенсорных — перенос строки.
    if (!window.matchMedia('(pointer: fine)').matches) return
    e.preventDefault()
    submit()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="glass-composer rounded-[1.75rem] p-1.5">
        {reply && (
          <div className="glass-reply-in mb-1 flex items-center gap-2 pl-3 pr-1">
            <CornerUpLeft aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <div className="glass-quote-composer min-w-0 flex-1 rounded-md py-1 pl-2 pr-2">
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-primary">
                {reply.authorName || t('chat.feed.unknownAuthor')}
              </span>
              <span className="block truncate text-[0.8125rem] leading-snug text-muted-foreground">
                {reply.deleted ? t('chats.preview.deleted') : reply.body || t('chat.feed.attachment')}
              </span>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                clearReply(chatId)
                area.current?.focus({ preventScroll: true })
              }}
              aria-label={t('chat.reply.cancel')}
              className="glass-press flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1 px-3.5 py-[0.6875rem]">
            <textarea
              ref={area}
              rows={1}
              value={text}
              maxLength={MAX_BODY}
              placeholder={t('chat.composer.placeholder')}
              aria-label={t('chat.composer.placeholder')}
              autoComplete="off"
              onChange={(e) => change(e.target.value)}
              onKeyDown={onKeyDown}
              className="block max-h-36 w-full resize-none overflow-y-auto bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground"
            />
          </div>
          {remaining <= SHOW_COUNTER_AT && (
            <span
              aria-label={t('chat.composer.remaining', { count: remaining })}
              className={cn('mb-3 shrink-0 text-xs tabular-nums', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}
            >
              {remaining}
            </span>
          )}
          <button
            type="button"
            disabled={!canSend}
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            aria-label={t('chat.composer.send')}
            className="glass-press relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className="glass-accent absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none"
              style={{ opacity: canSend ? 1 : 0 }}
            />
            <ArrowUp className={cn('relative size-5 transition-colors duration-200 motion-reduce:transition-none', canSend && 'text-[color:var(--out-fg)]')} />
          </button>
        </div>
      </div>
    </div>
  )
}

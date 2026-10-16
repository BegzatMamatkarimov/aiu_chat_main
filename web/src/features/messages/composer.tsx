import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, CornerUpLeft, ImagePlus, LoaderCircle, Mic, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/use-auth'
import { getDraft, setDraft } from '@/features/messages/drafts'
import { clearReply, getReplyTarget, registerComposer, useReplyTarget } from '@/features/messages/reply-store'
import { MediaError, MAX_PHOTOS, prepareImage } from '@/features/messages/image-compress'
import { MAX_BODY, useSendMessage, type DraftPhoto } from '@/features/messages/send-message'
import { useVoiceRecorder } from '@/features/messages/use-voice-recorder'
import { RecordingBar } from '@/features/messages/recording-bar'

/** 6 строк по 24px (leading-6). */
const MAX_HEIGHT = 144
const SHOW_COUNTER_AT = 200

export function Composer({ chatId }: { chatId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { send, sendVoice } = useSendMessage(chatId)
  const voice = useVoiceRecorder()
  const voiceBusy = voice.state !== 'idle'
  const [text, setText] = useState(() => getDraft(uid, chatId))
  const area = useRef<HTMLTextAreaElement>(null)
  const reply = useReplyTarget(chatId)

  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [processing, setProcessing] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const photosRef = useRef(photos)
  const queued = useRef(0)

  const canSend = (text.trim().length > 0 || photos.length > 0) && processing === 0 && text.length <= MAX_BODY
  const showMic = text.trim().length === 0 && photos.length === 0 && processing === 0
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

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  // Миниатюры, не ушедшие в сообщение, освобождаются при уходе из чата.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const addFiles = async (files: File[]) => {
    const room = MAX_PHOTOS - photosRef.current.length - queued.current
    if (files.length > room) toast.error(t('chat.media.tooMany', { count: MAX_PHOTOS }))
    const take = files.slice(0, Math.max(room, 0))
    queued.current += take.length
    setProcessing((n) => n + take.length)
    for (const file of take) {
      try {
        const img = await prepareImage(file)
        const url = URL.createObjectURL(img.blob)
        setPhotos((list) => [...list, { ...img, id: crypto.randomUUID(), url }])
      } catch (e) {
        toast.error(t(e instanceof MediaError && e.code === 'tooLarge' ? 'chat.media.tooLarge' : 'chat.media.unsupported'))
      }
      queued.current -= 1
      setProcessing((n) => n - 1)
    }
  }

  const removePhoto = (id: string) => {
    const p = photosRef.current.find((x) => x.id === id)
    if (p) URL.revokeObjectURL(p.url)
    setPhotos((list) => list.filter((x) => x.id !== id))
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0 || e.clipboardData.getData('text/plain')) return
    e.preventDefault()
    void addFiles(files)
  }

  const change = (value: string) => {
    setText(value)
    setDraft(uid, chatId, value)
  }

  const submit = () => {
    if (!canSend) return
    if (!send(text, getReplyTarget(chatId), photos)) return
    setPhotos([])
    clearReply(chatId)
    change('')
    area.current?.focus({ preventScroll: true })
  }

  const submitVoice = async () => {
    const clip = await voice.finish()
    if (!clip) return
    if (sendVoice(clip, getReplyTarget(chatId))) clearReply(chatId)
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
        {(photos.length > 0 || processing > 0) && (
          <div className="flex gap-2 overflow-x-auto px-2 pb-1.5 pt-2">
            {photos.map((p) => (
              <div key={p.id} className="relative size-16 shrink-0">
                <img src={p.url} alt="" draggable={false} className="glass-photo size-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label={t('chat.composer.removePhoto')}
                  className="glass-viewer-btn absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full"
                  style={{ background: 'var(--photo-scrim)' }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {processing > 0 && (
              <div role="status" aria-label={t('chat.composer.processing')} className="glass-photo flex size-16 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
                <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" />
              </div>
            )}
          </div>
        )}
        {voiceBusy && (
          <RecordingBar recording={voice.state === 'recording'} elapsed={voice.elapsed} level={voice.level} onCancel={voice.cancel} onSend={() => void submitVoice()} />
        )}
        <div className={cn('items-end gap-1.5', voiceBusy ? 'hidden' : 'flex')}>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (files.length) void addFiles(files)
            }}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInput.current?.click()}
            aria-label={t('chat.composer.attach')}
            className="glass-press flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            <ImagePlus className="size-5" />
          </button>
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
              onPaste={onPaste}
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
          {showMic ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void voice.start()}
              aria-label={t('chat.voice.record')}
              className="glass-press flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <Mic className="size-5" />
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}

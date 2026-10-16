import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPreview, releasePreview, useSignedUrl } from '@/features/messages/media-url'
import type { ChatMessage, MessageAttachment } from '@/features/messages/message-model'

const MAX_VISIBLE = 4

function Photo({
  att,
  sent,
  single,
  extra,
  onOpen,
}: {
  att: MessageAttachment
  sent: boolean
  single: boolean
  extra: number
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const [, bump] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const path = att.storagePath
  const preview = getPreview(path)
  const q = useSignedUrl(path, sent)
  const url = q.data

  // Серверная картинка догружена в кэш браузера — локальный blob больше не нужен.
  useEffect(() => {
    if (!url || !getPreview(path)) return
    const img = new Image()
    img.onload = () => {
      releasePreview(path)
      bump((n) => n + 1)
    }
    img.src = url
  }, [url, path])

  const src = preview ?? url
  const failed = q.isError && !preview
  const ratio = att.width && att.height ? Math.min(2.2, Math.max(0.5, att.width / att.height)) : 4 / 3
  const open = failed ? () => void q.refetch() : onOpen

  return (
    <button
      type="button"
      onClick={open}
      aria-label={failed ? t('chat.media.loadError') : t('chat.media.open')}
      style={single ? { aspectRatio: String(ratio) } : undefined}
      className={cn('glass-photo relative block w-full overflow-hidden', !single && 'aspect-square')}
    >
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn('size-full object-cover', !loaded && 'opacity-0')}
        />
      )}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="size-6" />
        </span>
      )}
      {extra > 0 && (
        <span className="glass-photo-scrim absolute inset-0 flex items-center justify-center text-xl font-semibold">+{extra}</span>
      )}
    </button>
  )
}

/** Фото в пузыре: одно — с пропорциями из width/height, несколько — сетка 2 колонки (до 4 видимых). */
export function MessagePhotos({ msg, onOpen }: { msg: ChatMessage; onOpen: (index: number) => void }) {
  const images = msg.attachments.filter((a) => a.kind === 'image')
  if (images.length === 0) return null
  const single = images.length === 1
  const shown = images.slice(0, MAX_VISIBLE)
  const sent = msg.status === 'sent'
  return (
    <div className={cn('glass-photos relative overflow-hidden rounded-xl', single ? 'w-[min(280px,70vw)] md:w-[min(360px,50vw)]' : 'grid w-[min(280px,70vw)] grid-cols-2 gap-0.5 md:w-[min(360px,50vw)]')}>
      {shown.map((a, i) => (
        <Photo
          key={a.id}
          att={a}
          sent={sent}
          single={single}
          extra={i === MAX_VISIBLE - 1 ? images.length - MAX_VISIBLE : 0}
          onOpen={() => onOpen(i)}
        />
      ))}
      {msg.status === 'sending' && (
        <span aria-hidden="true" className="glass-photo-scrim pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-8 animate-spin motion-reduce:animate-none" />
        </span>
      )}
    </div>
  )
}

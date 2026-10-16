import { useState, type CSSProperties } from 'react'
import { hueOf } from '@/lib/hue'

/** Аватар чата: инициалы или картинка, статичный. */
export function ChatAvatar({
  chatId,
  label,
  size,
  side,
  src,
}: {
  chatId: string
  label: string
  src?: string | null
  size: number
  side: 'list' | 'header'
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const image = src && failed !== src ? src : null

  return (
    <span
      aria-hidden="true"
      className={`glass-av inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${side === 'header' ? 'shadow-md' : ''}`}
      style={
        {
          '--h': hueOf(chatId),
          width: size,
          height: size,
          fontSize: Math.max(11, Math.round(size * (label.length > 2 ? 0.3 : 0.36))),
        } as CSSProperties
      }
    >
      {image ? (
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(image)} className="size-full rounded-full object-cover" />
      ) : (
        label
      )}
    </span>
  )
}

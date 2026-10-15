import { useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useShell } from '@/features/chats/shell-context'
import { hueOf } from '@/lib/hue'
import { EASE_DRAWER } from '@/lib/motion'

/**
 * Аватар чата. На телефоне (если не reduced-motion) аватар в списке и в шапке открытого чата
 * делят layoutId, поэтому «перелетают» при открытии и закрытии.
 */
export function ChatAvatar({
  chatId,
  label,
  size,
  side,
  src,
  fly = true,
}: {
  chatId: string
  label: string
  src?: string | null
  size: number
  side: 'list' | 'header'
  /** Строка в неактивной панели папок не получает layoutId: та же группа лежит и в соседней панели. */
  fly?: boolean
}) {
  const { desktop, open } = useShell()
  const reduce = useReducedMotion()
  const shared = !desktop && !reduce && fly && (side === 'list' || open)
  const [failed, setFailed] = useState<string | null>(null)
  const image = src && failed !== src ? src : null

  const avatar = (
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
        <img src={image} alt="" draggable={false} onError={() => setFailed(image)} className="size-full rounded-full object-cover" />
      ) : (
        label
      )}
    </span>
  )
  if (!shared) return avatar
  return (
    <motion.span layoutId={`av-${chatId}`} className="inline-flex shrink-0" transition={{ duration: 0.28, ease: EASE_DRAWER }}>
      {avatar}
    </motion.span>
  )
}

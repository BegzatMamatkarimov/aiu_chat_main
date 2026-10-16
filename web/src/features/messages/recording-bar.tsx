import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/features/messages/voice-utils'

export function RecordingBar({
  recording,
  elapsed,
  level,
  onCancel,
  onSend,
}: {
  recording: boolean
  elapsed: number
  level: RefObject<HTMLSpanElement | null>
  onCancel: () => void
  onSend: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onCancel}
        aria-label={t('chat.voice.cancel')}
        className="glass-press flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <Trash2 className="size-5" />
      </button>
      <div role="timer" aria-label={t('chat.voice.recording')} className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full bg-destructive', recording && 'animate-pulse motion-reduce:animate-none')} />
        <span className="w-12 shrink-0 text-base tabular-nums">{formatDuration(elapsed)}</span>
        <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-current/10">
          <span ref={level} className="block h-full origin-left rounded-full bg-primary" style={{ transform: 'scaleX(0)' }} />
        </span>
      </div>
      <button
        type="button"
        onClick={onSend}
        aria-label={t('chat.composer.send')}
        className="glass-press glass-accent flex size-11 shrink-0 items-center justify-center rounded-full text-[color:var(--out-fg)]"
      >
        <ArrowUp className="size-5" />
      </button>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConnectionProblem } from '@/features/messages/connection-status'

/** Маленькая плашка «Нет соединения…» / «Соединение…»; пропадает, когда realtime снова подключён. */
export function ConnectionBanner({ className }: { className?: string }) {
  const { t } = useTranslation()
  const problem = useConnectionProblem()
  if (!problem) return null
  return (
    <p
      role="status"
      className={cn(
        'flex w-fit items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        className,
      )}
    >
      <WifiOff aria-hidden="true" className="size-3.5 shrink-0" />
      {t(problem === 'offline' ? 'connection.offline' : 'connection.connecting')}
    </p>
  )
}

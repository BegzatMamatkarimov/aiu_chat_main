import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Стеклянная карточка. Внутри работают CardHeader/CardTitle/CardContent из ui/card. */
export function GlassCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'glass-panel group/card flex flex-col gap-(--card-spacing) rounded-3xl py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(6)]',
        className,
      )}
      {...props}
    />
  )
}

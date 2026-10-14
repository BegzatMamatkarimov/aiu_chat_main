import { cn } from '@/lib/utils'

/** Mesh-градиент. `fixed` — на весь экран за приложением, иначе заполняет родителя (position: relative). */
export function GlassBackground({ fixed = false, className }: { fixed?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('glass-mesh inset-0', fixed ? 'fixed -z-10' : 'absolute', className)}
    >
      <i />
      <i />
      <i />
    </div>
  )
}

/** Учебный SVG-узор поверх фона; цвет берётся из токена --pattern-color. */
export function GlassPattern({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('glass-pattern absolute inset-0', className)} />
}

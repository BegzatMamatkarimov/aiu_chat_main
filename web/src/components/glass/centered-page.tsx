import type { ReactNode } from 'react'
import { GlassPattern } from '@/components/glass/glass-background'

/** Полноэкранная страница по центру (вход, онбординг, вступление): узор поверх общего фона. */
export function CenteredPage({ children, toolbar }: { children: ReactNode; toolbar?: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <GlassPattern className="fixed -z-10" />
      {toolbar && (
        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2">
          {toolbar}
        </div>
      )}
      {children}
    </main>
  )
}

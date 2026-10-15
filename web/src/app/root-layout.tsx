import { Outlet } from 'react-router'
import { MotionConfig } from 'motion/react'
import { GlassBackground } from '@/components/glass/glass-background'
import { Toaster } from '@/components/ui/sonner'
import { LocaleSync } from '@/features/profile/locale-sync'
import { useRouteThemeColor } from '@/app/use-theme-color'

export function RootLayout() {
  useRouteThemeColor()
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-dvh text-foreground">
        <GlassBackground fixed />
        <Outlet />
        <Toaster />
        <LocaleSync />
      </div>
    </MotionConfig>
  )
}

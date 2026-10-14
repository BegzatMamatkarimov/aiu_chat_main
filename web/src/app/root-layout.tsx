import { Link, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/features/auth/use-auth'
import { LocaleSync } from '@/features/profile/locale-sync'

export function RootLayout() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const showNav = pathname !== '/login'
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Временная навигация для этапа 0 */}
      {showNav && (
        <nav className="flex items-center gap-4 border-b p-4">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/login">{t('nav.login')}</Link>
          <Link to="/settings">{t('nav.settings')}</Link>
          {user && (
            <div className="ml-auto flex items-center gap-2">
              <span>{profile?.display_name || user.email}</span>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                {t('auth.signOut')}
              </Button>
            </div>
          )}
        </nav>
      )}
      <Outlet />
      <Toaster />
      <LocaleSync />
    </div>
  )
}

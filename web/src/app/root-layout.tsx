import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

export function RootLayout() {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Временная навигация для этапа 0 */}
      <nav className="flex gap-4 border-b p-4">
        <Link to="/">{t('nav.home')}</Link>
        <Link to="/login">{t('nav.login')}</Link>
        <Link to="/settings">{t('nav.settings')}</Link>
      </nav>
      <Outlet />
    </div>
  )
}

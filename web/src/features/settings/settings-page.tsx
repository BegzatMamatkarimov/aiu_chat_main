import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.settings.title')}</h1>
      <div className="mt-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </main>
  )
}

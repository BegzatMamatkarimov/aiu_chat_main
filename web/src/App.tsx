import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export default function App() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{t('app.name')}</h1>
          <p className="mt-2 text-muted-foreground">{t('app.tagline')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button>{t('app.name')}</Button>
        <Button variant="outline">{t('app.name')}</Button>
      </div>
    </div>
  )
}

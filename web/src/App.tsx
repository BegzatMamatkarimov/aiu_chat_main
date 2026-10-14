import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function App() {
  const { t } = useTranslation()
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-sky-600">{t('app.name')}</h1>
      <p className="mt-2 text-neutral-600">{t('app.tagline')}</p>
      <div className="mt-4">
        <LanguageSwitcher />
      </div>
    </div>
  )
}

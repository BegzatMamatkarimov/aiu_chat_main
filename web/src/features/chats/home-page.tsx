import { useTranslation } from 'react-i18next'

export function HomePage() {
  const { t } = useTranslation()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.home.title')}</h1>
    </main>
  )
}

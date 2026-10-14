import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.login.title')}</h1>
    </main>
  )
}

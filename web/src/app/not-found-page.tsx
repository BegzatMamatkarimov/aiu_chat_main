import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.notFound.title')}</h1>
      <Link to="/" className="mt-2 inline-block text-primary underline">
        {t('pages.notFound.back')}
      </Link>
    </main>
  )
}

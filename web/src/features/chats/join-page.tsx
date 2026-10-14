import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

export function JoinPage() {
  const { t } = useTranslation()
  const { code } = useParams()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.join.title')}</h1>
      <p className="mt-2 text-muted-foreground">{code}</p>
    </main>
  )
}

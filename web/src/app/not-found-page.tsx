import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CenteredPage } from '@/components/glass/centered-page'
import { GlassCard } from '@/components/glass/glass-card'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <CenteredPage>
      <GlassCard className="w-full max-w-[400px] px-(--card-spacing)">
        <h1 className="text-2xl font-bold">{t('pages.notFound.title')}</h1>
        <Link to="/" className="text-primary underline">
          {t('pages.notFound.back')}
        </Link>
      </GlassCard>
    </CenteredPage>
  )
}

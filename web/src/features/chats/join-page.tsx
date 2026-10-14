import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { CenteredPage } from '@/components/glass/centered-page'
import { GlassCard } from '@/components/glass/glass-card'

export function JoinPage() {
  const { t } = useTranslation()
  const { code } = useParams()
  return (
    <CenteredPage>
      <GlassCard className="w-full max-w-[400px] px-(--card-spacing)">
        <h1 className="text-2xl font-bold">{t('pages.join.title')}</h1>
        <p className="text-muted-foreground">{code}</p>
      </GlassCard>
    </CenteredPage>
  )
}

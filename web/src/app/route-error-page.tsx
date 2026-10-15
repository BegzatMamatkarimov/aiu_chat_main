import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GlassBackground } from '@/components/glass/glass-background'
import { CenteredPage } from '@/components/glass/centered-page'
import { GlassCard } from '@/components/glass/glass-card'
import { Button } from '@/components/ui/button'
import { NotFoundPage } from '@/app/not-found-page'
import { isChunkLoadError } from '@/app/chunk-reload'

export function RouteErrorPage() {
  const error = useRouteError()
  const { t } = useTranslation()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="relative isolate min-h-dvh text-foreground">
        <GlassBackground fixed />
        <NotFoundPage />
      </div>
    )
  }

  if (!isChunkLoadError(error)) console.error(error)

  return (
    <div className="relative isolate min-h-dvh text-foreground">
      <GlassBackground fixed />
      <CenteredPage>
        <GlassCard className="w-full max-w-[400px] px-(--card-spacing)">
          <h1 className="text-2xl font-bold">
            {isChunkLoadError(error) ? t('pages.loadError.title') : t('pages.loadError.generic')}
          </h1>
          <p className="text-muted-foreground">{t('pages.loadError.hint')}</p>
          <Button onClick={() => window.location.reload()}>{t('pages.loadError.reload')}</Button>
        </GlassCard>
      </CenteredPage>
    </div>
  )
}

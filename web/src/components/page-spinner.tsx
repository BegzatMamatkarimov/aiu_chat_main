import { useTranslation } from 'react-i18next'

export function PageSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div
        role="status"
        aria-label={t('common.loading')}
        className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary"
      />
    </div>
  )
}

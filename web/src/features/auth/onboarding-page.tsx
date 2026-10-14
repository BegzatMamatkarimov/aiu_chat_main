import { useTranslation } from 'react-i18next'

export function OnboardingPage() {
  const { t } = useTranslation()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.onboarding.title')}</h1>
    </main>
  )
}

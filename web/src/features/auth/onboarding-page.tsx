import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { getSafeNext } from '@/features/auth/safe-next'
import { ProfileForm } from '@/features/profile/profile-form'
import { Card, CardContent } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export function OnboardingPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = getSafeNext(searchParams.get('next'))

  if (profile?.username && !searchParams.has('edit')) {
    return <Navigate to={next} replace />
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('pages.onboarding.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
        </div>
        <Card>
          <CardContent>
            <ProfileForm
              submitLabel={t('onboarding.submit')}
              onSaved={() => void navigate(next, { replace: true })}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

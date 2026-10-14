import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { useCourseLabel } from '@/features/profile/course'
import { ProfileForm } from '@/features/profile/profile-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0])
  return letters.join('').toUpperCase() || '?'
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const courseLabel = useCourseLabel()

  const handleSignOut = async () => {
    await signOut()
    void navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t('pages.settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {profile && (
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
                >
                  {initials(profile.display_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{profile.display_name}</p>
                {profile.username && (
                  <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
                )}
                {profile.course && (
                  <p className="truncate text-sm text-muted-foreground">
                    {courseLabel(profile.course)}
                  </p>
                )}
                {profile.major && (
                  <p className="truncate text-sm text-muted-foreground">{profile.major}</p>
                )}
              </div>
            </div>
          )}
          <ProfileForm submitLabel={t('settings.save')} onSaved={() => {}} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label>{t('settings.language')}</Label>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label>{t('settings.theme')}</Label>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => void handleSignOut()}>
        <LogOut />
        {t('auth.signOut')}
      </Button>
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSafeNext } from '@/features/auth/safe-next'
import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { CenteredPage } from '@/components/glass/centered-page'
import { GlassCard } from '@/components/glass/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

type Mode = 'signIn' | 'signUp'

const ERROR_KEYS = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_already_exists: 'auth.errors.userExists',
  email_exists: 'auth.errors.userExists',
  weak_password: 'auth.errors.weakPassword',
  over_request_rate_limit: 'auth.errors.rateLimit',
  over_email_send_rate_limit: 'auth.errors.rateLimit',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  validation_failed: 'auth.errors.invalidEmail',
} as const

function errorKey(code: string | undefined) {
  return code && code in ERROR_KEYS
    ? ERROR_KEYS[code as keyof typeof ERROR_KEYS]
    : 'auth.errors.generic'
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('signIn')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const resetMessages = () => {
    setError(null)
    setInfo(null)
  }

  const handleModeChange = (value: string) => {
    setMode(value as Mode)
    resetMessages()
  }

  const handleGoogle = async () => {
    resetMessages()
    setLoading(true)
    try {
      const next = getSafeNext(searchParams.get('next'))
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (err) {
        setError(t(errorKey(err.code)))
        setLoading(false)
      }
    } catch {
      setError(t('auth.errors.generic'))
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    resetMessages()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password || (mode === 'signUp' && !trimmedName)) {
      setError(t('auth.errors.required'))
      return
    }
    if (mode === 'signUp') {
      if (trimmedName.length > 64) {
        setError(t('auth.errors.nameTooLong'))
        return
      }
      if (password.length < 8) {
        setError(t('auth.errors.passwordTooShort'))
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'signIn') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (err) setError(t(errorKey(err.code)))
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { full_name: trimmedName } },
        })
        if (err) setError(t(errorKey(err.code)))
        else if (!data.session) setInfo(t('auth.signUp.checkEmail'))
      }
    } catch {
      setError(t('auth.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const renderForm = (formMode: Mode) => {
    const isSignUp = formMode === 'signUp'
    return (
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
        {isSignUp && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('auth.fields.name')}</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="text-base md:text-sm"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formMode}-email`}>{t('auth.fields.email')}</Label>
          <Input
            id={`${formMode}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="text-base md:text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formMode}-password`}>{t('auth.fields.password')}</Label>
          <Input
            id={`${formMode}-password`}
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="text-base md:text-sm"
          />
          {isSignUp && <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="text-sm text-muted-foreground">
            {info}
          </p>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {t(isSignUp ? 'auth.signUp.submit' : 'auth.signIn.submit')}
        </Button>
      </form>
    )
  }

  return (
    <CenteredPage
      toolbar={
        <>
          <LanguageSwitcher />
          <ThemeToggle />
        </>
      }
    >
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('app.name')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('app.tagline')}</p>
        </div>
        <GlassCard>
          <CardContent className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void handleGoogle()}
            >
              <GoogleLogo />
              {t('auth.google')}
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
              <Separator className="flex-1" />
            </div>
            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList className="w-full">
                <TabsTrigger value="signIn">{t('auth.tabs.signIn')}</TabsTrigger>
                <TabsTrigger value="signUp">{t('auth.tabs.signUp')}</TabsTrigger>
              </TabsList>
              <TabsContent value="signIn" className="mt-4">
                {renderForm('signIn')}
              </TabsContent>
              <TabsContent value="signUp" className="mt-4">
                {renderForm('signUp')}
              </TabsContent>
            </Tabs>
          </CardContent>
        </GlassCard>
      </div>
    </CenteredPage>
  )
}

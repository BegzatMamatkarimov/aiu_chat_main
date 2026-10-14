import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { getSafeNext } from '@/features/auth/safe-next'
import { PageSpinner } from '@/components/page-spinner'

const TIMEOUT_MS = 10_000

export function AuthCallbackPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [])

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const urlError =
    params.get('error_description') ?? params.get('error') ?? hash.get('error_description') ?? hash.get('error')

  if (session) return <Navigate to={getSafeNext(params.get('next'))} replace />

  if (urlError || timedOut) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
        <p role="alert">{urlError ?? t('auth.callback.error')}</p>
        <Link to="/login" className="text-primary underline">
          {t('auth.callback.backToLogin')}
        </Link>
      </main>
    )
  }

  return <PageSpinner />
}

import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/use-auth'
import { getSafeNext } from '@/features/auth/safe-next'
import { PageSpinner } from '@/components/page-spinner'

export function RequireAuth() {
  const { session, initializing, profile, profileLoading } = useAuth()
  const { pathname, search } = useLocation()

  if (initializing || profileLoading) return <PageSpinner />

  const next = encodeURIComponent(pathname + search)
  if (!session) return <Navigate to={'/login?next=' + next} replace />

  if (profile && !profile.username && pathname !== '/onboarding') {
    return <Navigate to={'/onboarding?next=' + next} replace />
  }
  return <Outlet />
}

export function RedirectIfAuthed() {
  const { session, initializing } = useAuth()
  const [params] = useSearchParams()

  if (initializing) return <PageSpinner />
  if (session) return <Navigate to={getSafeNext(params.get('next'))} replace />
  return <Outlet />
}

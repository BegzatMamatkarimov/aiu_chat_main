import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/app/root-layout'
import { RequireAuth, RedirectIfAuthed } from '@/app/guards'
import { PageSpinner } from '@/components/page-spinner'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    hydrateFallbackElement: <PageSpinner />,
    children: [
      {
        element: <RedirectIfAuthed />,
        children: [
          {
            path: 'login',
            lazy: async () => ({ Component: (await import('@/features/auth/login-page')).LoginPage }),
          },
        ],
      },
      {
        path: 'auth/callback',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-callback-page')).AuthCallbackPage,
        }),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('@/features/chats/home-page')).HomePage }),
          },
          {
            path: 'c/:chatId',
            lazy: async () => ({ Component: (await import('@/features/messages/chat-page')).ChatPage }),
          },
          {
            path: 'join/:code',
            lazy: async () => ({ Component: (await import('@/features/chats/join-page')).JoinPage }),
          },
          {
            path: 'settings',
            lazy: async () => ({
              Component: (await import('@/features/settings/settings-page')).SettingsPage,
            }),
          },
          {
            path: 'onboarding',
            lazy: async () => ({
              Component: (await import('@/features/auth/onboarding-page')).OnboardingPage,
            }),
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/app/not-found-page')).NotFoundPage }),
      },
    ],
  },
])

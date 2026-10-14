import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/app/root-layout'
import { NotFoundPage } from '@/app/not-found-page'
import { HomePage } from '@/features/chats/home-page'
import { JoinPage } from '@/features/chats/join-page'
import { ChatPage } from '@/features/messages/chat-page'
import { LoginPage } from '@/features/auth/login-page'
import { SettingsPage } from '@/features/settings/settings-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'c/:chatId', element: <ChatPage /> },
      { path: 'join/:code', element: <JoinPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import '@/app/i18n'
import './index.css'
import './glass.css'
import { ThemeProvider } from '@/app/theme-provider'
import { queryClient } from '@/app/query-client'
import { AuthProvider } from '@/features/auth/auth-provider'
import { router } from '@/app/router'
import { installChunkReloadHandler } from '@/app/chunk-reload'

installChunkReloadHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)

window.__aiuBootDone?.()

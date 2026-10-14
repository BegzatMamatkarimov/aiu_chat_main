import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'aiu-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLORS = { light: '#f2f6fb', dark: '#0e141f' }

function isTheme(value: string | null): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
      // Выбор темы в приложении может отличаться от системной: красим строку состояния по нему.
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = THEME_COLORS[dark ? 'dark' : 'light']
      })
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // storage unavailable
        }
        setThemeState(next)
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

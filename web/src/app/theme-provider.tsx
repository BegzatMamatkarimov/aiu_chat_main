import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'aiu-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

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
  /** Тема после учёта системной: тёмная ли сейчас. */
  dark: boolean
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  const dark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const sync = () => setSystemDark(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      dark,
      setTheme: (next) => {
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // storage unavailable
        }
        setThemeState(next)
      },
    }),
    [theme, dark],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

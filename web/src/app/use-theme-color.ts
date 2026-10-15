import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useTheme } from '@/app/theme-provider'
import { THEME_COLORS } from '@/app/theme-colors'

type Surface = 'bar' | 'page'

/** Красит строку состояния: в светлой теме индиго над индиго-шапкой, иначе цвет фона страницы; в тёмной — тёмный. */
export function useThemeColor(surface: Surface) {
  const { dark } = useTheme()
  useEffect(() => {
    const color = dark ? THEME_COLORS.dark : THEME_COLORS[surface]
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = color
    })
  }, [dark, surface])
}

/** Индиго-шапка есть у списка чатов, чата и «О группе»: «/» и «/c/…». */
function hasBar(pathname: string) {
  return pathname === '/' || pathname.startsWith('/c/')
}

export function useRouteThemeColor() {
  const { pathname } = useLocation()
  useThemeColor(hasBar(pathname) ? 'bar' : 'page')
}

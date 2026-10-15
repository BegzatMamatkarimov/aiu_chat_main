import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { THEME_COLORS } from './src/app/theme-colors.ts'

// Подставляет цвета из src/app/theme-colors.ts в index.html (meta theme-color и загрузочная заглушка).
function themeColors(): Plugin {
  return {
    name: 'theme-colors',
    transformIndexHtml: (html) =>
      html
        .replaceAll('__THEME_BAR__', THEME_COLORS.bar)
        .replaceAll('__THEME_PAGE__', THEME_COLORS.page)
        .replaceAll('__THEME_DARK__', THEME_COLORS.dark),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), themeColors()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})

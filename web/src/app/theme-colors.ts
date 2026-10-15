/**
 * Цвета строки состояния телефона (meta theme-color): bar — индиго-шапка, page — светлый фон страницы без шапки,
 * dark — тёмная тема. Единственное место с hex: index.html получает их при сборке (vite.config.ts).
 */
export const THEME_COLORS = { bar: '#393085', page: '#f8f7fc', dark: '#0e141f' } as const

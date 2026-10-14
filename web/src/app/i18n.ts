import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from '@/locales/ru.json'
import kk from '@/locales/kk.json'
import en from '@/locales/en.json'

export const SUPPORTED_LANGUAGES = ['kk', 'ru', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'aiu-lang'
const FALLBACK_LANGUAGE: Language = 'ru'

function isSupported(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function readStoredLanguage(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isSupported(value) ? value : null
  } catch {
    return null
  }
}

function detectLanguage(): Language {
  const stored = readStoredLanguage()
  if (stored) return stored
  for (const tag of navigator.languages ?? []) {
    const prefix = tag.split('-')[0].toLowerCase()
    if (isSupported(prefix)) return prefix
  }
  return FALLBACK_LANGUAGE
}

const resources = {
  ru: { translation: ru },
  kk: { translation: kk },
  en: { translation: en },
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof ru }
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18n.language

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // storage unavailable
  }
})

export default i18n

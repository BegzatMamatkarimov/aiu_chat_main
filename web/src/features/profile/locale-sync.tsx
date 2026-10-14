import { useEffect, useRef } from 'react'
import i18n, { SUPPORTED_LANGUAGES, type Language } from '@/app/i18n'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'

function hasStoredLanguage() {
  try {
    return localStorage.getItem('aiu-lang') !== null
  } catch {
    return false
  }
}

function isLanguage(value: string): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

export function LocaleSync() {
  const { user, profile, refetchProfile } = useAuth()
  const userId = user?.id ?? null
  const profileLocale = profile?.locale ?? null
  const profileLoaded = profile !== null

  const state = useRef({ userId, profileLocale, refetchProfile })
  useEffect(() => {
    state.current = { userId, profileLocale, refetchProfile }
  })

  useEffect(() => {
    if (!profileLoaded || !profileLocale) return
    if (hasStoredLanguage()) return
    if (isLanguage(profileLocale) && profileLocale !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(profileLocale)
    }
  }, [profileLoaded, profileLocale])

  useEffect(() => {
    const handler = (lng: string) => {
      const { userId: id, profileLocale: current, refetchProfile: refetch } = state.current
      if (!id || !isLanguage(lng) || lng === current) return
      void (async () => {
        try {
          const { error } = await supabase.from('profiles').update({ locale: lng }).eq('id', id)
          if (error) throw error
          await refetch()
        } catch (err) {
          console.warn('Failed to sync locale', err)
        }
      })()
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [])

  return null
}

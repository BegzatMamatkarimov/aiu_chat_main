import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LANGUAGES } from '@/app/i18n'

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const current = SUPPORTED_LANGUAGES.find((l) => l === i18n.resolvedLanguage) ?? 'ru'

  return (
    <select
      aria-label={t('language.label')}
      value={current}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <option key={lng} value={lng}>
          {t(`language.${lng}`)}
        </option>
      ))}
    </select>
  )
}

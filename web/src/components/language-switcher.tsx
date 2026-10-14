import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LANGUAGES } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function LanguageSwitcher() {
  const { t, i18n: instance } = useTranslation()
  const current = SUPPORTED_LANGUAGES.find((l) => l === instance.resolvedLanguage) ?? 'ru'

  return (
    <Select value={current} onValueChange={(lng) => void i18n.changeLanguage(lng)}>
      <SelectTrigger aria-label={t('language.label')} className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            {t(`language.${lng}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

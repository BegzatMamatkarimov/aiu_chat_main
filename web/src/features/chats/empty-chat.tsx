import { useTranslation } from 'react-i18next'
import { GlassPattern } from '@/components/glass/glass-background'

export function EmptyChat() {
  const { t } = useTranslation()
  return (
    <div className="relative flex h-full items-center justify-center">
      <GlassPattern />
      <p className="glass-pill relative rounded-full px-4 py-1.5 text-sm text-muted-foreground">{t('chats.select')}</p>
    </div>
  )
}

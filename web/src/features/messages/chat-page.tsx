import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

export function ChatPage() {
  const { t } = useTranslation()
  const { chatId } = useParams()
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">{t('pages.chat.title')}</h1>
      <p className="mt-2 text-muted-foreground">{chatId}</p>
    </main>
  )
}

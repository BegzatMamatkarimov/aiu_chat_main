import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { GlassPattern } from '@/components/glass/glass-background'

export function ChatPage() {
  const { t } = useTranslation()
  const { chatId = '' } = useParams()
  const navigate = useNavigate()
  // Название и данные чата подключаются в следующих задачах.
  const title = t('pages.chat.title')

  return (
    <div className="relative h-full overflow-hidden">
      <GlassPattern />
      <header className="glass-bar absolute inset-x-0 top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 px-2 pt-[env(safe-area-inset-top)] md:px-4">
        <button
          type="button"
          onClick={() => void navigate('/')}
          aria-label={t('chats.backToList')}
          className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary md:hidden"
        >
          <ChevronLeft className="size-7" />
        </button>
        <ChatAvatar chatId={chatId} label="#" size={40} side="header" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
        </div>
      </header>
      <div className="absolute inset-0 flex items-center justify-center px-4 pt-[calc(4rem+env(safe-area-inset-top))]">
        <p className="glass-pill relative rounded-full px-4 py-1.5 text-sm text-muted-foreground">{t('chat.soon')}</p>
      </div>
    </div>
  )
}

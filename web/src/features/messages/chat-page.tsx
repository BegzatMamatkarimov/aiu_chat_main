import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MessageCircleOff } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { GlassPattern } from '@/components/glass/glass-background'
import { Button } from '@/components/ui/button'
import { useCloseChat } from '@/features/chats/use-close-chat'
import { useChatHeader, useMemberCount, type ChatHeader } from '@/features/chats/use-chat-header'
import { GroupMenu } from '@/features/messages/group-menu'
import { initials } from '@/features/profile/initials'
import { useCourseLabel } from '@/features/profile/course'

function BackButton() {
  const { t } = useTranslation()
  const close = useCloseChat()
  return (
    <button
      type="button"
      onClick={close}
      aria-label={t('chats.backToList')}
      className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary md:hidden"
    >
      <ChevronLeft className="size-7" />
    </button>
  )
}

const HEADER_CLASS =
  'glass-bar absolute inset-x-0 top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 px-2 pt-[env(safe-area-inset-top)] md:px-4'

function Subtitle({ chat }: { chat: ChatHeader }) {
  const { t } = useTranslation()
  const courseLabel = useCourseLabel()
  const members = useMemberCount(chat.id, chat.type === 'group')
  const text =
    chat.type === 'group'
      ? typeof members.data === 'number'
        ? t('chat.members', { count: members.data })
        : ''
      : courseLabel(chat.peer?.course)
  if (!text) return null
  return <p className="truncate text-xs leading-tight text-muted-foreground">{text}</p>
}

export function ChatPage() {
  const { t } = useTranslation()
  const { chatId = '' } = useParams()
  const close = useCloseChat()
  const state = useChatHeader(chatId)

  if (state.status === 'ready') {
    const { chat } = state
    return (
      <div className="relative h-full overflow-hidden">
        <GlassPattern />
        <header className={HEADER_CLASS}>
          <BackButton />
          <ChatAvatar chatId={chat.id} label={initials(chat.title)} src={chat.avatarUrl} size={40} side="header" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold leading-tight">{chat.title}</h2>
            <Subtitle chat={chat} />
          </div>
          {chat.type === 'group' && <GroupMenu chatId={chat.id} title={chat.title} />}
        </header>
        <div className="absolute inset-0 flex items-center justify-center px-4 pt-[calc(4rem+env(safe-area-inset-top))]">
          <p className="glass-pill relative rounded-full px-4 py-1.5 text-sm text-muted-foreground">{t('chat.soon')}</p>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="relative h-full overflow-hidden">
        <GlassPattern />
        <header className={HEADER_CLASS}>
          <BackButton />
          <span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-foreground/10" />
        </header>
      </div>
    )
  }

  const missing = state.status === 'missing'
  return (
    <div className="relative h-full overflow-hidden">
      <GlassPattern />
      <header className={HEADER_CLASS}>
        <BackButton />
      </header>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-[calc(4rem+env(safe-area-inset-top))] text-center">
        <span className="glass-accent mb-4 flex size-14 items-center justify-center rounded-2xl shadow-md">
          <MessageCircleOff className="size-7" />
        </span>
        <p className="text-base font-semibold">{t(missing ? 'chat.notFound.title' : 'chat.loadError')}</p>
        {missing && <p className="mt-1 max-w-64 text-sm text-muted-foreground">{t('chat.notFound.hint')}</p>}
        <Button type="button" variant="secondary" className="mt-4" onClick={missing ? close : state.retry}>
          {t(missing ? 'chat.notFound.toList' : 'chats.retry')}
        </Button>
      </div>
    </div>
  )
}

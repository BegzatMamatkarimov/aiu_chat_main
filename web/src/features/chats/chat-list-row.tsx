import { Link } from 'react-router'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { FROM_LIST_STATE } from '@/features/chats/use-close-chat'
import { initials } from '@/features/profile/initials'

export type ChatListItem = {
  id: string
  title: string
  preview: string
  time: string
  unread: number
  avatarUrl?: string | null
}

export function ChatListRow({ chat, active }: { chat: ChatListItem; active: boolean }) {
  return (
    <Link
      to={`/c/${chat.id}`}
      state={FROM_LIST_STATE}
      aria-current={active ? 'page' : undefined}
      className={`glass-press mb-0.5 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left ${active ? 'glass-accent' : 'glass-row'}`}
    >
      <ChatAvatar chatId={chat.id} label={initials(chat.title)} src={chat.avatarUrl} size={52} side="list" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.9375rem] font-semibold">{chat.title}</span>
          <span className={`shrink-0 text-xs tabular-nums ${active ? 'opacity-80' : 'text-muted-foreground'}`}>{chat.time}</span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`line-clamp-2 text-[0.8125rem] leading-snug ${active ? 'opacity-85' : 'text-muted-foreground'}`}>
            {chat.preview}
          </span>
          {chat.unread > 0 && (
            <span className="glass-badge flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}

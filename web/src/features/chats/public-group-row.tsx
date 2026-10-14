import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { Button } from '@/components/ui/button'
import { initials } from '@/features/profile/initials'
import type { PublicGroup } from '@/features/chats/use-public-groups'

export function PublicGroupRow({ group, joining, disabled, onJoin }: { group: PublicGroup; joining: boolean; disabled: boolean; onJoin: () => void }) {
  const { t } = useTranslation()
  const desc = group.description?.replace(/\s+/g, ' ').trim()
  return (
    <div className="mb-0.5 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5">
      <ChatAvatar chatId={group.id} label={initials(group.name)} src={group.avatarUrl} size={52} side="header" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{group.name}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] leading-snug text-muted-foreground">
          {t('chats.members', { count: group.memberCount })}
          {desc ? ` · ${desc}` : ''}
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        onClick={onJoin}
        disabled={disabled}
        aria-busy={joining}
        aria-label={`${t('chats.join.action')}: ${group.name}`}
        className="glass-accent glass-press h-8 min-w-[5.5rem] shrink-0 rounded-full border-0 px-3.5 font-semibold hover:opacity-90"
      >
        {joining ? <Loader2 className="size-4 motion-safe:animate-spin" /> : t('chats.join.action')}
      </Button>
    </div>
  )
}

import { ChatAvatar } from '@/components/glass/chat-avatar'
import { initials } from '@/features/profile/initials'
import { useCourseLabel } from '@/features/profile/course'
import type { Person } from '@/features/chats/use-people'

export function PersonRow({ person, disabled, onOpen }: { person: Person; disabled: boolean; onOpen: () => void }) {
  const courseLabel = useCourseLabel()
  const name = person.displayName || `@${person.username}`
  const sub = [`@${person.username}`, courseLabel(person.course)].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="glass-press mb-0.5 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <ChatAvatar chatId={person.id} label={initials(name)} src={person.avatarUrl} size={52} side="header" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{name}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] leading-snug text-muted-foreground">{sub}</span>
      </span>
    </button>
  )
}

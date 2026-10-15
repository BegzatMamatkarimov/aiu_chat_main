import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { EllipsisVertical, Info, Link2, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FROM_CHAT_STATE } from '@/features/messages/use-close-info'
import { LeaveDialog } from '@/features/messages/leave-dialog'
import { useShareInvite } from '@/features/chats/use-share-invite'

/** Меню группы в шапке чата: «О группе», приглашение по ссылке и выход. */
export function GroupMenu({ chatId, title }: { chatId: string; title: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { share } = useShareInvite(chatId, title)
  const [leaveOpen, setLeaveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('chat.menu.label')}
            className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <EllipsisVertical className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => void navigate(`/c/${chatId}/info`, { state: FROM_CHAT_STATE })}>
            <Info />
            {t('chat.menu.info')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void share()}>
            <Link2 />
            {t('chat.menu.invite')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setLeaveOpen(true)}>
            <LogOut />
            {t('chat.menu.leave')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LeaveDialog chatId={chatId} title={title} open={leaveOpen} onOpenChange={setLeaveOpen} />
    </>
  )
}

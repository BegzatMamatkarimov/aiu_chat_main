import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/glass/confirm-dialog'
import { useAuth } from '@/features/auth/use-auth'
import { useMyChats } from '@/features/chats/use-my-chats'
import { useAdminSuccessor, useLeaveChat } from '@/features/chats/use-invite'

/** Подтверждение выхода из группы (используется в меню чата и на экране «О группе»). */
export function LeaveDialog({ chatId, title, open, onOpenChange }: { chatId: string; title: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const myChats = useMyChats()
  const isAdmin = myChats.data?.find((c) => c.id === chatId)?.role === 'admin'
  const successor = useAdminSuccessor(chatId, open && isAdmin, user?.id)
  const leave = useLeaveChat()

  const confirm = () => {
    if (leave.isPending) return
    leave.mutate(chatId, {
      onSuccess: () => {
        void navigate('/', { replace: true })
        toast.success(t('chat.leave.done', { name: title }))
      },
      onError: () => toast.error(t('chat.leave.error')),
    })
  }

  // Пока преемник грузится, показываем общую фразу; если передавать некому (есть другой admin) или запрос упал, строки нет.
  let note: string | undefined
  if (isAdmin && !successor.isError) {
    if (successor.isSuccess && successor.data) note = t('chat.leave.adminNote', { name: successor.data })
    else if (!successor.isSuccess) note = t('chat.leave.adminNoteGeneric')
  }
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('chat.leave.title', { name: title })}
      body={t('chat.leave.body')}
      note={note}
      cancelLabel={t('chat.leave.cancel')}
      confirmLabel={t('chat.leave.confirm')}
      pending={leave.isPending}
      onConfirm={confirm}
    />
  )
}

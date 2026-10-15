import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EllipsisVertical, Link2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/use-auth'
import { useMyChats } from '@/features/chats/use-my-chats'
import { useAdminSuccessor, useInviteCode, useLeaveChat } from '@/features/chats/use-invite'
import { useIsDesktop } from '@/lib/use-media-query'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      area.remove()
    }
  }
}

function LeaveDialog({ chatId, title, open, onOpenChange }: { chatId: string; title: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const myChats = useMyChats()
  const isAdmin = myChats.data?.find((c) => c.id === chatId)?.role === 'admin'
  const successor = useAdminSuccessor(chatId, open && isAdmin, user?.id)
  const leave = useLeaveChat()
  const sending = leave.isPending

  const change = (next: boolean) => {
    if (!next && sending) return
    onOpenChange(next)
  }

  const confirm = () => {
    if (sending) return
    leave.mutate(chatId, {
      onSuccess: () => {
        void navigate('/', { replace: true })
        toast.success(t('chat.leave.done', { name: title }))
      },
      onError: () => toast.error(t('chat.leave.error')),
    })
  }

  const successorName = successor.data
  const adminNote = isAdmin && successor.isSuccess && successor.data !== null
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogPortal>
        <DialogOverlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogContent className="glass-panel pointer-events-auto relative w-[min(24rem,calc(100vw-2rem))] rounded-3xl p-5 text-foreground duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <DialogTitle className="text-lg leading-snug">{t('chat.leave.title', { name: title })}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">{t('chat.leave.body')}</DialogDescription>
          {adminNote && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {successorName ? t('chat.leave.adminNote', { name: successorName }) : t('chat.leave.adminNoteGeneric')}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => change(false)} disabled={sending}>
              {t('chat.leave.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={sending} aria-busy={sending}>
              {sending && <Loader2 className="motion-safe:animate-spin" />}
              {t('chat.leave.confirm')}
            </Button>
          </div>
        </DialogContent>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

/** Меню группы в шапке чата: приглашение по ссылке и выход. */
export function GroupMenu({ chatId, title }: { chatId: string; title: string }) {
  const { t } = useTranslation()
  const desktop = useIsDesktop()
  const invite = useInviteCode(chatId, true)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const share = async () => {
    let code = invite.data
    if (!code) {
      const r = await invite.refetch()
      code = r.data
    }
    if (!code) {
      toast.error(t('chat.invite.error'))
      return
    }
    const url = `${location.origin}/join/${code}`
    if (!desktop && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: t('chat.invite.shareText', { name: title }), url })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    if (await copyText(url)) toast.success(t('chat.invite.copied'))
    else toast.error(t('chat.invite.error'))
  }

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

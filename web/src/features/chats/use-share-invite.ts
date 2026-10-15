import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyText, inviteUrl } from '@/features/chats/invite-link'
import { useInviteCode } from '@/features/chats/use-invite'
import { useIsDesktop } from '@/lib/use-media-query'

/** На телефоне, где есть системное «Поделиться», открывает его; иначе копирует ссылку-приглашение. */
export function useShareInvite(chatId: string, title: string) {
  const { t } = useTranslation()
  const desktop = useIsDesktop()
  const invite = useInviteCode(chatId, true)
  const canShare = !desktop && typeof navigator.share === 'function'

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
    const url = inviteUrl(code)
    if (canShare) {
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

  return { share, canShare, code: invite.data ?? null, isLoading: invite.isPending }
}

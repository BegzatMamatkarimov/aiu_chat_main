import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { MY_CHATS_KEY } from '@/features/chats/use-my-chats'
import { AvatarCropper } from '@/features/profile/avatar-cropper'
import { removeAvatarObject, removeOwnAvatar, uploadAvatar } from '@/features/profile/avatar-storage'
import { initials } from '@/features/profile/initials'
import { supabase } from '@/lib/supabase'

/** Аватар профиля 80 px с кнопками «Изменить фото» / «Удалить фото». */
export function ProfileAvatarEditor() {
  const { t } = useTranslation()
  const { profile, refetchProfile } = useAuth()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  if (!profile) return null
  const old = profile.avatar_url

  const save = async (blob: Blob | null) => {
    setBusy(true)
    let uploaded: { path: string; url: string } | null = null
    try {
      if (blob) uploaded = await uploadAvatar(profile.id, 'avatar', blob)
      const { error } = await supabase.from('profiles').update({ avatar_url: uploaded?.url ?? null }).eq('id', profile.id)
      if (error) throw error
      void removeOwnAvatar(profile.id, old)
      await refetchProfile()
      void qc.invalidateQueries({ queryKey: MY_CHATS_KEY })
      toast.success(t('avatar.updated'))
    } catch {
      if (uploaded) void removeAvatarObject(uploaded.path)
      toast.error(t('avatar.uploadError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <span className="relative shrink-0">
          <ChatAvatar chatId={profile.id} label={initials(profile.display_name)} src={old} size={80} side="header" />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
              <Loader2 className="size-6 animate-spin" />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <AvatarCropper onCropped={(b) => void save(b)} disabled={busy} />
          {old && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void save(null)} disabled={busy} className="text-destructive">
              <Trash2 />
              {t('avatar.remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

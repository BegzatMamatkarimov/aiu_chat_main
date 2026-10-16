import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { ResponsiveSheet } from '@/components/glass/responsive-sheet'
import { Button } from '@/components/ui/button'
import { DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/use-auth'
import { AvatarCropper } from '@/features/profile/avatar-cropper'
import { removeAvatarObject, removeOwnAvatar, uploadAvatar } from '@/features/profile/avatar-storage'
import { initials } from '@/features/profile/initials'
import { Counter, GroupTypeRadios } from '@/features/chats/group-form-parts'
import { useUpdateGroup, type GroupInfo } from '@/features/chats/use-group-admin'
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from '@/features/chats/use-create-group'

function EditGroupForm({
  group,
  nameRef,
  onDone,
}: {
  group: GroupInfo
  nameRef: React.RefObject<HTMLInputElement | null>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const update = useUpdateGroup(group.id)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const shownAvatar = photoRemoved ? null : (preview ?? group.avatarUrl)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [isPublic, setIsPublic] = useState(group.isPublic)
  const [nameError, setNameError] = useState(false)
  const trimmed = name.trim()
  const pending = update.isPending || uploading

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!trimmed) {
      setNameError(true)
      nameRef.current?.focus()
      return
    }
    const desc = description.trim()
    const avatarChanged = !!photo || photoRemoved
    if (!avatarChanged && trimmed === group.name && desc === (group.description ?? '') && isPublic === group.isPublic) {
      onDone()
      return
    }
    let uploaded: { path: string; url: string } | null = null
    if (photo && user) {
      setUploading(true)
      try {
        uploaded = await uploadAvatar(user.id, `group-${group.id}`, photo)
      } catch {
        toast.error(t('avatar.uploadError'))
        return
      } finally {
        setUploading(false)
      }
    }
    update.mutate(
      { name: trimmed, description: desc, isPublic, avatarUrl: uploaded ? uploaded.url : photoRemoved ? null : undefined },
      {
        onSuccess: () => {
          if (avatarChanged && user) void removeOwnAvatar(user.id, group.avatarUrl)
          toast.success(t('group.edit.saved'))
          onDone()
        },
        onError: () => {
          if (uploaded) void removeAvatarObject(uploaded.path)
          toast.error(t('group.edit.error'))
        },
      },
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex min-h-0 flex-auto flex-col">
      <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-5 pb-1 pt-1">
        <div className="flex items-center gap-4 pb-1">
          <ChatAvatar chatId={group.id} label={initials(trimmed || group.name)} src={shownAvatar} size={72} side="header" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <AvatarCropper
              disabled={pending}
              onCropped={(b) => {
                setPhoto(b)
                setPhotoRemoved(false)
              }}
            />
            {shownAvatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-destructive"
                onClick={() => {
                  setPhoto(null)
                  setPhotoRemoved(true)
                }}
              >
                <Trash2 />
                {t('avatar.remove')}
              </Button>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="edit-group-name" className="mb-1.5">
            {t('chats.create.name')}
          </Label>
          <Input
            ref={nameRef}
            id="edit-group-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(false)
            }}
            maxLength={GROUP_NAME_MAX}
            autoComplete="off"
            enterKeyHint="go"
            aria-invalid={nameError}
            aria-describedby="edit-group-name-hint"
            className="h-10"
          />
          <div id="edit-group-name-hint" className="mt-1 flex min-h-4 gap-2 text-xs">
            {nameError && (
              <span role="alert" className="text-destructive">
                {t('chats.create.nameRequired')}
              </span>
            )}
            <Counter value={name} max={GROUP_NAME_MAX} />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-group-description" className="mb-1.5">
            {t('chats.create.description')}
          </Label>
          <Textarea
            id="edit-group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={GROUP_DESCRIPTION_MAX}
            rows={3}
            placeholder={t('chats.create.descriptionPlaceholder')}
            aria-describedby="edit-group-description-hint"
          />
          <div id="edit-group-description-hint" className="mt-1 flex min-h-4 text-xs">
            <Counter value={description} max={GROUP_DESCRIPTION_MAX} />
          </div>
        </div>
        <GroupTypeRadios idPrefix="edit-group-type" value={isPublic} hintId="edit-group-type-hint" onChange={setIsPublic} />
      </div>
      <div className="space-y-2.5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <DialogDescription id="edit-group-type-hint" className="text-xs">
          {t(isPublic ? 'chats.create.publicHint' : 'chats.create.privateHint')}
        </DialogDescription>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="h-11 w-full text-base">
          {pending && <Loader2 className="animate-spin" />}
          {t('group.edit.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Окно «Изменить группу»: название, описание, тип (только для admin). */
export function EditGroupDialog({ group, open, onOpenChange }: { group: GroupInfo; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const nameRef = useRef<HTMLInputElement>(null)
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('group.edit.title')}
      closeLabel={t('chats.create.close')}
      describedBy="edit-group-type-hint"
      focusRef={nameRef}
      sheetKey="edit-group"
    >
      <EditGroupForm group={group} nameRef={nameRef} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  )
}

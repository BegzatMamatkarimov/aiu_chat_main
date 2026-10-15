import { useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ResponsiveSheet } from '@/components/glass/responsive-sheet'
import { Button } from '@/components/ui/button'
import { DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/use-auth'
import { Counter, GroupTypeRadios } from '@/features/chats/group-form-parts'
import { clearGroupDraft, readGroupDraft, writeGroupDraft } from '@/features/chats/group-draft'
import {
  CreateGroupError,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  useCreateGroup,
} from '@/features/chats/use-create-group'
import { initials } from '@/features/profile/initials'
import { hueOf } from '@/lib/hue'

type Created = { id: string; name: string | null; isPublic: boolean; inviteCode: string }

function CreateGroupForm({
  nameRef,
  pending,
  failed,
  invalidName,
  onSubmit,
}: {
  nameRef: RefObject<HTMLInputElement | null>
  pending: boolean
  failed: boolean
  invalidName: boolean
  onSubmit: (name: string, description: string, isPublic: boolean) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [initial] = useState(() => readGroupDraft(user?.id))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [nameError, setNameError] = useState(false)
  const trimmed = name.trim()
  const showNameError = nameError || invalidName

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!trimmed) {
      setNameError(true)
      nameRef.current?.focus()
      return
    }
    onSubmit(trimmed, description.trim(), isPublic)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-auto flex-col">
      <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-5 pb-1 pt-1">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="glass-av inline-flex size-14 shrink-0 select-none items-center justify-center rounded-full text-lg font-semibold shadow-md"
            style={{ '--h': hueOf(trimmed) } as CSSProperties}
          >
            {initials(trimmed)}
          </span>
          <div className="min-w-0 flex-1">
            <Label htmlFor="group-name" className="mb-1.5">
              {t('chats.create.name')}
            </Label>
            <Input
              ref={nameRef}
              id="group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(false)
                writeGroupDraft(user?.id, e.target.value, description, isPublic)
              }}
              maxLength={GROUP_NAME_MAX}
              placeholder={t('chats.create.namePlaceholder')}
              autoComplete="off"
              enterKeyHint="go"
              aria-invalid={showNameError}
              aria-describedby="group-name-hint"
              className="h-10"
            />
          </div>
        </div>
        <div id="group-name-hint" className="flex min-h-4 gap-2 text-xs">
          {showNameError && (
            <span role="alert" className="text-destructive">
              {t('chats.create.nameRequired')}
            </span>
          )}
          <Counter value={name} max={GROUP_NAME_MAX} />
        </div>
        <div>
          <Label htmlFor="group-description" className="mb-1.5">
            {t('chats.create.description')}
          </Label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              writeGroupDraft(user?.id, name, e.target.value, isPublic)
            }}
            maxLength={GROUP_DESCRIPTION_MAX}
            rows={3}
            placeholder={t('chats.create.descriptionPlaceholder')}
            aria-describedby="group-description-hint"
          />
          <div id="group-description-hint" className="mt-1 flex min-h-4 text-xs">
            <Counter value={description} max={GROUP_DESCRIPTION_MAX} />
          </div>
        </div>
        <GroupTypeRadios
          idPrefix="group-type"
          value={isPublic}
          hintId="group-type-hint"
          onChange={(value) => {
            setIsPublic(value)
            writeGroupDraft(user?.id, name, description, value)
          }}
        />
      </div>
      <div className="space-y-2.5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t('chats.create.error')}
          </p>
        )}
        <DialogDescription id="group-type-hint" className="text-xs">{t(isPublic ? 'chats.create.publicHint' : 'chats.create.privateHint')}</DialogDescription>
        <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
          {pending && <Loader2 className="animate-spin" />}
          {t('chats.create.submit')}
        </Button>
      </div>
    </form>
  )
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (group: Created) => void
}) {
  const { t } = useTranslation()
  const nameRef = useRef<HTMLInputElement>(null)
  const create = useCreateGroup()
  const sending = useRef(false)
  const invalidName = create.error instanceof CreateGroupError && create.error.invalidName
  const failed = create.isError && !invalidName

  const change = (next: boolean) => {
    // Пока группа создаётся, окно не закрываем: иначе пользователь не увидит результат.
    if (!next && create.isPending) return
    if (!next) create.reset()
    onOpenChange(next)
  }

  const submit = (name: string, description: string, isPublic: boolean) => {
    // isPending обновляется после перерисовки, а двойной клик приходит раньше.
    if (sending.current) return
    sending.current = true
    create.mutate(
      { name, description, isPublic },
      {
        onSettled: () => {
          sending.current = false
        },
        onSuccess: (group) => {
          clearGroupDraft()
          create.reset()
          onCreated({ id: group.id, name: group.name, isPublic: group.is_public, inviteCode: group.invite_code })
        },
      },
    )
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={change}
      title={t('chats.create.title')}
      closeLabel={t('chats.create.close')}
      describedBy="group-type-hint"
      focusRef={nameRef}
      sheetKey="create-group"
    >
      <CreateGroupForm nameRef={nameRef} pending={create.isPending} failed={failed} invalidName={invalidName} onSubmit={submit} />
    </ResponsiveSheet>
  )
}

import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, LinkIcon, Lock } from 'lucide-react'
import { CenteredPage } from '@/components/glass/centered-page'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { GlassCard } from '@/components/glass/glass-card'
import { Button } from '@/components/ui/button'
import { useGroupPreview, useJoinByCode } from '@/features/chats/use-invite'
import { initials } from '@/features/profile/initials'

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-3 motion-safe:animate-pulse">
      <span className="size-20 rounded-full bg-foreground/10" />
      <span className="h-6 w-48 rounded-lg bg-foreground/10" />
      <span className="h-4 w-64 rounded-lg bg-foreground/10" />
      <span className="h-4 w-28 rounded-lg bg-foreground/10" />
      <span className="mt-3 h-11 w-full rounded-full bg-foreground/10" />
    </div>
  )
}

function Notice({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="glass-accent flex size-14 items-center justify-center rounded-2xl shadow-md">
        <LinkIcon className="size-7" />
      </span>
      <p role="alert" className="text-base font-semibold">
        {message}
      </p>
      <Button type="button" variant="secondary" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}

export function JoinPage() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const preview = useGroupPreview(code.trim())
  const join = useJoinByCode()
  const toList = () => void navigate('/', { replace: true })
  const group = preview.data

  const open = (id: string) => void navigate(`/c/${id}`, { replace: true })
  const onJoin = () => {
    if (!group || join.isPending) return
    join.mutate(code.trim(), {
      onSuccess: (id) => {
        open(id)
        toast.success(t('join.done', { name: group.name }))
      },
      onError: () => toast.error(t('join.error')),
    })
  }

  let body
  if (preview.isPending) body = <Skeleton />
  else if (preview.isError)
    body = <Notice message={t('join.loadError')} action={t('chats.retry')} onAction={() => void preview.refetch()} />
  else if (!group) body = <Notice message={t('join.invalid')} action={t('chat.notFound.toList')} onAction={toList} />
  else
    body = (
      <div className="flex flex-col items-center text-center">
        <ChatAvatar chatId={group.id} label={initials(group.name)} src={group.avatarUrl} size={80} side="header" />
        <h1 className="mt-4 max-w-full break-words text-2xl font-bold tracking-tight">{group.name}</h1>
        {group.description && (
          <p className="mt-2 line-clamp-3 max-w-full whitespace-pre-line break-words text-sm text-muted-foreground">{group.description}</p>
        )}
        <p className="mt-2 flex max-w-full items-center justify-center gap-1.5 text-sm text-muted-foreground">
          {!group.isPublic && <Lock aria-hidden="true" className="size-4 shrink-0" />}
          <span className="truncate">
            {!group.isPublic && `${t('chat.privateGroup')} · `}
            {t('chat.members', { count: group.memberCount })}
          </span>
        </p>
        {group.isMember ? (
          <Button type="button" size="lg" className="mt-6 h-11 w-full text-base" onClick={() => open(group.id)}>
            {t('join.open')}
          </Button>
        ) : (
          <Button type="button" size="lg" className="mt-6 h-11 w-full text-base" onClick={onJoin} disabled={join.isPending} aria-busy={join.isPending}>
            {join.isPending && <Loader2 className="motion-safe:animate-spin" />}
            {t('join.action')}
          </Button>
        )}
      </div>
    )

  return (
    <CenteredPage>
      <GlassCard className="w-full max-w-[400px] px-(--card-spacing)">{body}</GlassCard>
    </CenteredPage>
  )
}

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, Copy, EllipsisVertical, Globe, LogOut, MessageCircle, MessageCircleOff, Pencil, Share2, ShieldCheck, ShieldOff, UserMinus, Lock } from 'lucide-react'
import { ChatAvatar } from '@/components/glass/chat-avatar'
import { ConfirmDialog } from '@/components/glass/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/use-auth'
import {
  isLastAdminError,
  useGroupInfo,
  useGroupMembers,
  useRemoveMember,
  useSetMemberRole,
  type GroupInfo,
  type GroupMember,
} from '@/features/chats/use-group-admin'
import { useOpenDirectChat } from '@/features/chats/use-people'
import { usePrefetchAdminSuccessor } from '@/features/chats/use-invite'
import { useShareInvite } from '@/features/chats/use-share-invite'
import { EditGroupDialog } from '@/features/messages/edit-group-dialog'
import { HEADER_CLASS } from '@/features/messages/header-class'
import { LeaveDialog } from '@/features/messages/leave-dialog'
import { useCloseInfo } from '@/features/messages/use-close-info'
import { useCourseLabel } from '@/features/profile/course'
import { initials } from '@/features/profile/initials'

function Header({ chatId, onEdit }: { chatId: string; onEdit?: () => void }) {
  const { t } = useTranslation()
  const close = useCloseInfo(chatId)
  return (
    <header className={HEADER_CLASS}>
      <button
        type="button"
        onClick={close}
        aria-label={t('group.info.back')}
        className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-7" />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">{t('group.info.title')}</h2>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('group.info.edit')}
          className="glass-press flex size-10 shrink-0 items-center justify-center rounded-full text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Pencil className="size-5" />
        </button>
      )}
    </header>
  )
}

const BODY_CLASS =
  'glass-scroll absolute inset-0 overflow-y-auto overflow-x-hidden pt-[calc(4rem+env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]'

function Notice({ chatId, message, hint, action, onAction }: { chatId: string; message: string; hint?: string; action: string; onAction: () => void }) {
  return (
    <div className="relative h-full">
      <Header chatId={chatId} />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-[calc(4rem+env(safe-area-inset-top))] text-center">
        <span className="glass-accent mb-4 flex size-14 items-center justify-center rounded-2xl shadow-md">
          <MessageCircleOff className="size-7" />
        </span>
        <p role="alert" className="text-base font-semibold">
          {message}
        </p>
        {hint && <p className="mt-1 max-w-64 text-sm text-muted-foreground">{hint}</p>}
        <Button type="button" variant="secondary" className="mt-4" onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  )
}

function Skeleton({ chatId }: { chatId: string }) {
  return (
    <div className="relative h-full">
      <Header chatId={chatId} />
      <div className={BODY_CLASS}>
        <div aria-hidden="true" className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 pt-6 motion-safe:animate-pulse">
          <span className="size-24 rounded-full bg-foreground/10" />
          <span className="h-7 w-48 rounded-lg bg-foreground/10" />
          <span className="h-4 w-32 rounded-lg bg-foreground/10" />
          <span className="mt-4 h-40 w-full rounded-3xl bg-foreground/10" />
        </div>
      </div>
    </div>
  )
}

function InviteBlock({ chatId, title }: { chatId: string; title: string }) {
  const { t } = useTranslation()
  const { share, canShare, code } = useShareInvite(chatId, title)
  const shown = code ? `${location.host}/join/${code}` : ''
  return (
    <section className="glass-panel rounded-3xl p-4">
      <h3 className="text-sm font-semibold">{t('group.info.invite')}</h3>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground" title={shown}>
          {shown || '…'}
        </div>
        <Button type="button" onClick={() => void share()} className="h-10 shrink-0 px-3.5">
          {canShare ? <Share2 /> : <Copy />}
          {t(canShare ? 'group.info.share' : 'group.info.copy')}
        </Button>
      </div>
    </section>
  )
}

function MemberRow({
  member,
  isMe,
  canManage,
  busy,
  writing,
  onWrite,
  onToggleRole,
  onRemove,
}: {
  member: GroupMember
  isMe: boolean
  canManage: boolean
  busy: boolean
  writing: boolean
  onWrite: () => void
  onToggleRole: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const courseLabel = useCourseLabel()
  const name = member.displayName || (member.username ? `@${member.username}` : t('group.info.noName'))
  const sub = [member.username ? `@${member.username}` : '', courseLabel(member.course)].filter(Boolean).join(' · ')
  const isAdmin = member.role === 'admin'
  return (
    <li className="glass-row flex min-w-0 items-center gap-3 px-3.5 py-2.5">
      <ChatAvatar chatId={member.userId} label={initials(name)} src={member.avatarUrl} size={44} side="list" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-medium leading-tight">{name}</span>
          {isMe && <span className="shrink-0 text-xs text-muted-foreground">{t('group.info.you')}</span>}
        </div>
        {sub && <p className="truncate text-xs leading-tight text-muted-foreground">{sub}</p>}
      </div>
      {isAdmin && (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t('group.info.admin')}</span>
      )}
      {!isMe && (
        <button
          type="button"
          onClick={onWrite}
          disabled={writing}
          aria-label={t('group.info.write', { name })}
          className="glass-press flex size-9 shrink-0 items-center justify-center rounded-full text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <MessageCircle className="size-5" />
        </button>
      )}
      {canManage && !isMe && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={t('group.info.memberMenu', { name })}
              className="glass-press -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <EllipsisVertical className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={onToggleRole}>
              {isAdmin ? <ShieldOff /> : <ShieldCheck />}
              {t(isAdmin ? 'group.info.revokeAdmin' : 'group.info.makeAdmin')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <UserMinus />
              {t('group.info.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

function GroupInfoContent({ group }: { group: GroupInfo }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const members = useGroupMembers(group.id)
  const setRole = useSetMemberRole(group.id)
  const removeMember = useRemoveMember(group.id)
  const [editOpen, setEditOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const direct = useOpenDirectChat()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)

  const list = members.data
  const isAdmin = !!user && !!list?.some((m) => m.userId === user.id && m.role === 'admin')
  const prefetchSuccessor = usePrefetchAdminSuccessor(group.id)
  useEffect(() => {
    if (isAdmin) prefetchSuccessor()
    // list: после смены ролей или состава преемник мог измениться.
  }, [isAdmin, prefetchSuccessor, list])
  const nameOf = (m: GroupMember) => m.displayName || (m.username ? `@${m.username}` : t('group.info.noName'))

  const fail = (e: unknown) => toast.error(t(isLastAdminError(e) ? 'group.info.errors.lastAdmin' : 'group.info.errors.generic'))

  const toggleRole = (m: GroupMember) => {
    if (setRole.isPending) return
    const next = m.role === 'admin' ? 'member' : 'admin'
    setBusyId(m.userId)
    setRole.mutate(
      { userId: m.userId, role: next },
      {
        onSuccess: () => toast.success(t(next === 'admin' ? 'group.info.madeAdmin' : 'group.info.revokedAdmin', { name: nameOf(m) })),
        onError: fail,
        onSettled: () => setBusyId(null),
      },
    )
  }

  const write = (m: GroupMember) => {
    direct.open(m.userId).then(
      (id) => {
        if (id) void navigate(`/c/${id}`)
      },
      () => toast.error(t('chats.people.openError')),
    )
  }

  const confirmRemove = () => {
    if (!removing || removeMember.isPending) return
    const m = removing
    removeMember.mutate(m.userId, {
      onSuccess: () => {
        setRemoving(null)
        toast.success(t('group.info.removed', { name: nameOf(m) }))
      },
      onError: (e) => {
        setRemoving(null)
        fail(e)
      },
    })
  }

  const count = list?.length
  return (
    <div className="relative h-full">
      <Header chatId={group.id} onEdit={isAdmin ? () => setEditOpen(true) : undefined} />
      <div className={BODY_CLASS}>
        <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-6">
          <div className="flex min-w-0 flex-col items-center text-center">
            <ChatAvatar chatId={group.id} label={initials(group.name)} src={group.avatarUrl} size={96} side="header" />
            <h1 className="mt-4 max-w-full break-words text-2xl font-bold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="mt-2 max-w-full whitespace-pre-line break-words text-sm text-muted-foreground">{group.description}</p>
            )}
            <p className="mt-2 flex max-w-full items-center justify-center gap-1.5 text-sm text-muted-foreground">
              {group.isPublic ? <Globe aria-hidden="true" className="size-4 shrink-0" /> : <Lock aria-hidden="true" className="size-4 shrink-0" />}
              <span className="truncate">
                {t(group.isPublic ? 'group.info.public' : 'chat.privateGroup')}
                {typeof count === 'number' && ` · ${t('chat.members', { count })}`}
              </span>
            </p>
          </div>

          <InviteBlock chatId={group.id} title={group.name} />

          <section aria-labelledby="group-members-title" className="glass-panel overflow-hidden rounded-3xl">
            <h3 id="group-members-title" className="px-4 pb-1 pt-4 text-sm font-semibold">
              {t('group.info.members')}
            </h3>
            {members.isPending ? (
              <div aria-hidden="true" className="space-y-3 p-4 motion-safe:animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="size-11 rounded-full bg-foreground/10" />
                    <span className="h-4 w-40 rounded-lg bg-foreground/10" />
                  </div>
                ))}
              </div>
            ) : members.isError || !list ? (
              <div className="flex flex-col items-center gap-3 p-4 text-center">
                <p role="alert" className="text-sm text-muted-foreground">
                  {t('group.info.membersError')}
                </p>
                <Button type="button" variant="secondary" onClick={() => void members.refetch()}>
                  {t('chats.retry')}
                </Button>
              </div>
            ) : (
              <ul className="pb-1.5">
                {list.map((m) => (
                  <MemberRow
                    key={m.userId}
                    member={m}
                    isMe={m.userId === user?.id}
                    canManage={isAdmin}
                    busy={busyId === m.userId}
                    writing={direct.pendingId !== null}
                    onWrite={() => write(m)}
                    onToggleRole={() => toggleRole(m)}
                    onRemove={() => setRemoving(m)}
                  />
                ))}
              </ul>
            )}
          </section>

          <Button type="button" variant="ghost" size="lg" className="glass-panel h-11 w-full rounded-2xl text-base text-destructive hover:bg-[var(--glass-panel-bg)] hover:text-destructive" onClick={() => setLeaveOpen(true)}>
            <LogOut />
            {t('chat.menu.leave')}
          </Button>
        </div>
      </div>

      <EditGroupDialog group={group} open={editOpen} onOpenChange={setEditOpen} />
      <LeaveDialog chatId={group.id} title={group.name} open={leaveOpen} onOpenChange={setLeaveOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('group.info.removeTitle', { name: removing ? nameOf(removing) : '', group: group.name })}
        body={t('group.info.removeBody')}
        cancelLabel={t('chat.leave.cancel')}
        confirmLabel={t('group.info.removeConfirm')}
        pending={removeMember.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  )
}

/** Экран «О группе»: сведения, ссылка-приглашение, участники; управление — для admin. Только для групп. */
export function GroupInfoPage() {
  const { t } = useTranslation()
  const { chatId = '' } = useParams()
  const navigate = useNavigate()
  const info = useGroupInfo(chatId)
  const toList = () => void navigate('/', { replace: true })

  if (info.isPending) return <Skeleton chatId={chatId} />
  if (info.isError)
    return <Notice chatId={chatId} message={t('chat.loadError')} action={t('chats.retry')} onAction={() => void info.refetch()} />
  if (!info.data)
    return <Notice chatId={chatId} message={t('chat.notFound.title')} hint={t('chat.notFound.hint')} action={t('chat.notFound.toList')} onAction={toList} />
  if (info.data.type !== 'group') return <Navigate to={`/c/${chatId}`} replace />
  return <GroupInfoContent group={info.data} />
}

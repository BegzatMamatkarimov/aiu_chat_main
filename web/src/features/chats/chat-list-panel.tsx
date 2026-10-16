import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMatch, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { CircleAlert, MessagesSquare, Search, SquarePen } from 'lucide-react'
import { toast } from 'sonner'
import { copyText, inviteUrl } from '@/features/chats/invite-link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { chatTitle, formatChatTime, matchesQuery, type ChatSummary } from '@/features/chats/chat-model'
import { CreateGroupDialog } from '@/features/chats/create-group-dialog'
import { ChatListRow, type ChatListItem } from '@/features/chats/chat-list-row'
import { ProfileMenu } from '@/features/chats/profile-menu'
import { PersonRow } from '@/features/chats/person-row'
import { usePeopleSearch, useOpenDirectChat, peopleQuery, type Person } from '@/features/chats/use-people'
import { PublicGroupRow } from '@/features/chats/public-group-row'
import { FROM_LIST_STATE } from '@/features/chats/use-close-chat'
import {
  JoinError,
  MIN_GROUP_QUERY,
  useJoinGroup,
  usePopularGroups,
  usePublicGroupSearch,
  type PublicGroup,
} from '@/features/chats/use-public-groups'
import { useMyChats, usePrivateGroupIds } from '@/features/chats/use-my-chats'
import { useFolderSwipe } from '@/features/chats/use-folder-swipe'
import { ConnectionBanner } from '@/features/messages/connection-banner'
import { useHeight } from '@/lib/use-height'
import { useIsDesktop } from '@/lib/use-media-query'

const FOLDERS = ['all', 'subject', 'direct'] as const
type Folder = (typeof FOLDERS)[number]

const SKELETON_DELAY = 200

function previewOf(chat: ChatSummary, meId: string | undefined, t: TFunction): string {
  const m = chat.lastMessage
  if (!m) return t('chats.noMessages')
  if (m.deleted) return t('chats.preview.deleted')
  const text = m.body?.replace(/\s+/g, ' ').trim()
  const content = text || (m.attachmentKind ? t(`chats.preview.${m.attachmentKind}`) : '')
  const mine = m.senderId !== null && m.senderId === meId
  const author = mine ? t('chats.preview.you') : chat.type === 'group' ? m.senderName?.trim() : ''
  return author ? `${author}: ${content}` : content
}

function ListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mb-0.5 flex items-center gap-3 px-2.5 py-2.5">
          <span className="size-[52px] shrink-0 rounded-full bg-foreground/10" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-1/2 rounded-full bg-foreground/10" />
            <span className="block h-3 w-4/5 rounded-full bg-foreground/10" />
          </span>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
}

function SectionNote({ children }: { children: ReactNode }) {
  return <p className="px-3 py-3 text-sm text-muted-foreground">{children}</p>
}

function EmptyState({ icon, title, hint, children }: { icon: 'chat' | 'error'; title: string; hint?: string; children?: ReactNode }) {
  const Icon = icon === 'chat' ? MessagesSquare : CircleAlert
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="glass-accent mb-4 flex size-14 items-center justify-center rounded-2xl shadow-md">
        <Icon className="size-7" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-64 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

export function ChatListPanel() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const list = useMyChats()
  const [folder, setFolder] = useState<Folder>('all')
  const folderIndex = FOLDERS.indexOf(folder)
  const reduce = !!useReducedMotion()
  const desktop = useIsDesktop()
  const pos = useMotionValue(0)
  const willChange = useMotionValue('auto')
  const thumbX = useTransform(pos, (p) => `${p * 100}%`)
  const trackX = useTransform(pos, (p) => `${(-p / FOLDERS.length) * 100}%`)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const headRef = useRef<HTMLDivElement>(null)
  const headH = useHeight(headRef)
  const navigate = useNavigate()
  const activeId = useMatch('/c/:chatId/*')?.params.chatId
  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const groupSearch = trimmed.length >= MIN_GROUP_QUERY
  const meId = user?.id
  const lang = i18n.language

  const privateIds = usePrivateGroupIds()
  const byFolder = useMemo(() => {
    const items = (f: Folder): ChatListItem[] =>
      (list.data ?? [])
        .filter((c) => (f === 'all' || (f === 'subject' ? c.type === 'group' : c.type === 'direct')) && matchesQuery(c, query))
        .map((c) => ({
          id: c.id,
          title: chatTitle(c),
          preview: previewOf(c, meId, t),
          time: c.lastMessage ? formatChatTime(c.lastMessage.createdAt, lang) : '',
          unread: c.unread,
          avatarUrl: c.type === 'direct' ? c.peer?.avatarUrl : c.avatarUrl,
          isPrivate: privateIds.has(c.id),
        }))
    return { all: items('all'), subject: items('subject'), direct: items('direct') }
  }, [list.data, query, meId, t, lang, privateIds])

  // Скелетон показываем только если загрузка затянулась, чтобы не мигал на быстрой сети.
  const [skeleton, setSkeleton] = useState(false)
  useEffect(() => {
    if (!list.isPending) return
    const id = window.setTimeout(() => setSkeleton(true), SKELETON_DELAY)
    return () => window.clearTimeout(id)
  }, [list.isPending])

  const found = usePublicGroupSearch(query)
  const join = useJoinGroup(meId)
  const people = usePeopleSearch(query, meId)
  const direct = useOpenDirectChat()
  const [peopleSkeleton, setPeopleSkeleton] = useState(false)
  useEffect(() => {
    if (!people.isPending) return
    const id = window.setTimeout(() => setPeopleSkeleton(true), SKELETON_DELAY)
    return () => {
      window.clearTimeout(id)
      setPeopleSkeleton(false)
    }
  }, [people.isPending])
  const joiningId = join.isPending ? join.variables : undefined
  const noChats = list.isSuccess && list.data.length === 0
  const popular = usePopularGroups(!searching && noChats)

  const [groupSkeleton, setGroupSkeleton] = useState(false)
  useEffect(() => {
    if (!found.isPending) return
    const id = window.setTimeout(() => setGroupSkeleton(true), SKELETON_DELAY)
    return () => {
      window.clearTimeout(id)
      setGroupSkeleton(false)
    }
  }, [found.isPending])

  const myIds = useMemo(() => new Set((list.data ?? []).map((c) => c.id)), [list.data])
  const foundGroups = found.groups?.filter((g) => !g.isMember && !myIds.has(g.id))
  const popularGroups = popular.data?.filter((g) => !g.isMember && !myIds.has(g.id)).slice(0, 5)

  const onJoin = (g: PublicGroup) =>
    join.mutate(g.id, {
      onSuccess: () => {
        setQuery('')
        void navigate(`/c/${g.id}`, { state: FROM_LIST_STATE })
        toast.success(t('chats.join.done', { name: g.name }))
      },
      onError: (e) => toast.error(e instanceof JoinError && e.denied ? t('chats.join.denied') : t('chats.join.error')),
    })

  const onOpenPerson = (p: Person) => {
    direct.open(p.id).then(
      (id) => {
        if (!id) return
        setQuery('')
        void navigate(`/c/${id}`, { state: FROM_LIST_STATE })
      },
      () => toast.error(t('chats.people.openError')),
    )
  }

  const onCreated = (g: { id: string; name: string | null; isPublic: boolean; inviteCode: string }) => {
    setCreating(false)
    setQuery('')
    void navigate(`/c/${g.id}`, { state: FROM_LIST_STATE })
    if (g.isPublic) toast.success(t('chats.create.done', { name: g.name }))
    else
      toast.success(t('chats.create.donePrivate', { name: g.name }), {
        action: {
          label: t('chats.create.copyLink'),
          onClick: () => {
            void copyText(inviteUrl(g.inviteCode)).then((ok) =>
              ok ? toast.success(t('chat.invite.copied')) : toast.error(t('chat.invite.error')),
            )
          },
        },
      })
  }

  const renderGroups = (groups: PublicGroup[]) =>
    groups.map((g) => (
      <PublicGroupRow key={g.id} group={g} joining={joiningId === g.id} disabled={join.isPending} onJoin={() => onJoin(g)} />
    ))

  const groupsSection = () => {
    if (!groupSearch) return <SectionNote>{t('chats.groups.minChars')}</SectionNote>
    if (found.isPending) return groupSkeleton ? <ListSkeleton rows={3} /> : null
    if (found.isError)
      return (
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <span className="text-sm text-muted-foreground">{t('chats.groups.error')}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void found.refetch()} disabled={found.isFetching}>
            {t('chats.retry')}
          </Button>
        </div>
      )
    if (!foundGroups?.length) return <SectionNote>{t('chats.groups.none')}</SectionNote>
    return renderGroups(foundGroups)
  }

  const peopleSection = () => {
    if (people.isPending) return peopleSkeleton ? <ListSkeleton rows={2} /> : null
    if (people.isError)
      return (
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <span className="text-sm text-muted-foreground">{t('chats.people.error')}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void people.refetch()} disabled={people.isFetching}>
            {t('chats.retry')}
          </Button>
        </div>
      )
    return people.people?.map((p) => (
      <PersonRow key={p.id} person={p} disabled={direct.pendingId !== null} onOpen={() => onOpenPerson(p)} />
    ))
  }

  const peopleActive = peopleQuery(query).length >= MIN_GROUP_QUERY
  const peopleShown = peopleActive && (people.isPending ? peopleSkeleton : people.isError || !!people.people?.length)
  const peopleEmpty = peopleActive && !people.isPending && !people.isError && !people.people?.length
  const groupsEmpty = groupSearch && !found.isPending && !found.isError && !foundGroups?.length

  const renderBody = (f: Folder) => {
    const visible = byFolder[f]
    return (
        <>
        {list.isPending ? (
          skeleton && <ListSkeleton />
        ) : list.isError && !list.data ? (
          <EmptyState icon="error" title={t('chats.error')}>
            <Button type="button" variant="secondary" onClick={() => void list.refetch()} disabled={list.isFetching} className="mt-4">
              {t('chats.retry')}
            </Button>
          </EmptyState>
        ) : searching ? (
          visible.length === 0 && (groupsEmpty || !groupSearch) && (peopleEmpty || !peopleActive) ? (
            <>
              <EmptyState icon="chat" title={t('chats.noResults')} />
              {!groupSearch && <SectionNote>{t('chats.groups.minChars')}</SectionNote>}
            </>
          ) : (
            <>
              {visible.length > 0 && (
                <section>
                  <SectionTitle>{t('chats.sections.mine')}</SectionTitle>
                  {visible.map((chat) => (
                    <ChatListRow key={chat.id} chat={chat} active={chat.id === activeId} />
                  ))}
                </section>
              )}
              <section>
                <SectionTitle>{t('chats.sections.groups')}</SectionTitle>
                {groupsSection()}
              </section>
              {peopleShown && (
                <section>
                  <SectionTitle>{t('chats.sections.people')}</SectionTitle>
                  {peopleSection()}
                </section>
              )}
            </>
          )
        ) : visible.length === 0 ? (
          f !== 'all' ? (
            <EmptyState icon="chat" title={t('chats.folderEmpty')} />
          ) : (
            <>
              <EmptyState icon="chat" title={t('chats.empty.title')} hint={t('chats.empty.hint')}>
                <Button type="button" variant="outline" onClick={() => setCreating(true)} className="mt-4">
                  {t('chats.create.emptyAction')}
                </Button>
              </EmptyState>
              {!!popularGroups?.length && (
                <section>
                  <SectionTitle>{t('chats.sections.popular')}</SectionTitle>
                  {renderGroups(popularGroups)}
                </section>
              )}
            </>
          )
        ) : (
          visible.map((chat) => <ChatListRow key={chat.id} chat={chat} active={chat.id === activeId} />)
        )}
      </>
    )
  }

  const swipeOn = !desktop && !searching && !list.isPending
  const { bind, goTo, clickCapture } = useFolderSwipe({
    enabled: swipeOn,
    index: folderIndex,
    count: FOLDERS.length,
    reduce,
    pos,
    willChange,
    onChange: (i) => setFolder(FOLDERS[i]),
  })
  const synced = useRef(0)
  useEffect(() => {
    if (synced.current === folderIndex) return
    synced.current = folderIndex
    goTo(folderIndex)
  }, [folderIndex, goTo])

  const panels = swipeOn ? FOLDERS : ([folder] as readonly Folder[])

  return (
    <div className="relative h-full overflow-hidden">
      <div
        ref={headRef}
        className="glass-bar absolute inset-x-0 top-0 z-10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <img src="/mark-white.png" alt={t('app.name')} width={32} height={32} decoding="async" className="size-8 shrink-0" />
            {t('app.name')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('chats.create.open')}
              onClick={() => setCreating(true)}
              className="glass-accent glass-press flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SquarePen className="size-5" />
            </button>
            <ProfileMenu />
          </div>
        </div>
        <ConnectionBanner className="mt-2" />
        <label className="glass-field mt-3 flex h-10 items-center gap-2 rounded-full px-3.5 text-muted-foreground shadow-sm focus-within:ring-2 focus-within:ring-primary/40">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault()
                setQuery('')
              }
            }}
            placeholder={t('chats.search')}
            aria-label={t('chats.search')}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
        <div role="tablist" aria-label={t('chats.folders.label')} className="glass-seg relative mt-3 flex rounded-full p-1">
          <motion.span
            aria-hidden="true"
            className="glass-seg-thumb absolute bottom-1 left-1 top-1 rounded-full"
            style={{ width: `calc((100% - 0.5rem) / ${FOLDERS.length})`, x: thumbX }}
          />
          {FOLDERS.map((f) => {
            const active = folder === f
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setFolder(f)}
                className={`relative flex h-8 flex-1 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-150 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="relative">{t(`chats.folders.${f}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        ref={bind}
        onClickCapture={clickCapture}
      >
        <motion.div
          className="flex h-full"
          style={{ width: `${panels.length * 100}%`, x: swipeOn ? trackX : 0, willChange }}
        >
          {panels.map((f) => (
            <div
              key={f}
              inert={f !== folder}
              className="glass-scroll h-full min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]"
              style={{ paddingTop: headH + 6, touchAction: 'pan-y' }}
            >
              {renderBody(f)}
            </div>
          ))}
        </motion.div>
      </div>
      <CreateGroupDialog open={creating} onOpenChange={setCreating} onCreated={onCreated} />
    </div>
  )
}

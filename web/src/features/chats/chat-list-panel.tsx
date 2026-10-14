import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMatch } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { motion } from 'motion/react'
import { CircleAlert, MessagesSquare, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { chatTitle, formatChatTime, matchesQuery, type ChatSummary } from '@/features/chats/chat-model'
import { ChatListRow, type ChatListItem } from '@/features/chats/chat-list-row'
import { ProfileMenu } from '@/features/chats/profile-menu'
import { useMyChats } from '@/features/chats/use-my-chats'
import { EASE_OUT } from '@/lib/motion'
import { useHeight } from '@/lib/use-height'

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

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      {Array.from({ length: 7 }, (_, i) => (
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
  const [query, setQuery] = useState('')
  const headRef = useRef<HTMLDivElement>(null)
  const headH = useHeight(headRef)
  const activeId = useMatch('/c/:chatId')?.params.chatId
  const searching = query.trim().length > 0
  const meId = user?.id
  const lang = i18n.language

  const visible = useMemo<ChatListItem[]>(
    () =>
      (list.data ?? [])
        .filter((c) => (folder === 'all' || (folder === 'subject' ? c.type === 'group' : c.type === 'direct')) && matchesQuery(c, query))
        .map((c) => ({
          id: c.id,
          title: chatTitle(c),
          preview: previewOf(c, meId, t),
          time: c.lastMessage ? formatChatTime(c.lastMessage.createdAt, lang) : '',
          unread: c.unread,
          avatarUrl: c.type === 'direct' ? c.peer?.avatarUrl : c.avatarUrl,
        })),
    [list.data, folder, query, meId, t, lang],
  )

  // Скелетон показываем только если загрузка затянулась, чтобы не мигал на быстрой сети.
  const [skeleton, setSkeleton] = useState(false)
  useEffect(() => {
    if (!list.isPending) return
    const id = window.setTimeout(() => setSkeleton(true), SKELETON_DELAY)
    return () => window.clearTimeout(id)
  }, [list.isPending])

  return (
    <div className="relative h-full overflow-hidden">
      <div
        ref={headRef}
        className="glass-bar absolute inset-x-0 top-0 z-10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="glass-accent flex size-8 items-center justify-center rounded-xl text-sm font-extrabold shadow-md">
              A
            </span>
            {t('app.name')}
          </h1>
          <ProfileMenu />
        </div>
        <label className="glass-field mt-3 flex h-10 items-center gap-2 rounded-full px-3.5 text-muted-foreground shadow-sm focus-within:ring-2 focus-within:ring-primary/40">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chats.search')}
            aria-label={t('chats.search')}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
        <div role="tablist" aria-label={t('chats.folders.label')} className="glass-seg mt-3 flex rounded-full p-1">
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
                {active && (
                  <motion.span
                    layoutId="glass-folder"
                    className="glass-seg-thumb absolute inset-0 rounded-full"
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  />
                )}
                <span className="relative">{t(`chats.folders.${f}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="glass-scroll absolute inset-0 overflow-y-auto px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]"
        style={{ paddingTop: headH + 6 }}
      >
        {list.isPending ? (
          skeleton && <ListSkeleton />
        ) : list.isError && !list.data ? (
          <EmptyState icon="error" title={t('chats.error')}>
            <Button type="button" variant="secondary" onClick={() => void list.refetch()} disabled={list.isFetching} className="mt-4">
              {t('chats.retry')}
            </Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          searching ? (
            <EmptyState icon="chat" title={t('chats.noResults')} />
          ) : folder !== 'all' ? (
            <EmptyState icon="chat" title={t('chats.folderEmpty')} />
          ) : (
            <EmptyState icon="chat" title={t('chats.empty.title')} hint={t('chats.empty.hint')} />
          )
        ) : (
          visible.map((chat) => <ChatListRow key={chat.id} chat={chat} active={chat.id === activeId} />)
        )}
      </div>
    </div>
  )
}

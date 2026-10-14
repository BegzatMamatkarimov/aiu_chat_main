import { useRef, useState } from 'react'
import { useMatch } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { MessagesSquare, Search } from 'lucide-react'
import { ChatListRow, type ChatListItem } from '@/features/chats/chat-list-row'
import { ProfileMenu } from '@/features/chats/profile-menu'
import { EASE_OUT } from '@/lib/motion'
import { useHeight } from '@/lib/use-height'

const FOLDERS = ['all', 'subject', 'direct'] as const
type Folder = (typeof FOLDERS)[number]

// Данные подключаются в задачах 4.3 (список) и 4.4 (поиск).
const CHATS: ChatListItem[] = []

export function ChatListPanel() {
  const { t } = useTranslation()
  const [folder, setFolder] = useState<Folder>('all')
  const [query, setQuery] = useState('')
  const headRef = useRef<HTMLDivElement>(null)
  const headH = useHeight(headRef)
  const activeId = useMatch('/c/:chatId')?.params.chatId
  const searching = query.trim().length > 0

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
        {CHATS.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="glass-accent mb-4 flex size-14 items-center justify-center rounded-2xl shadow-md">
              <MessagesSquare className="size-7" />
            </span>
            <p className="text-base font-semibold">{t(searching ? 'chats.noResults' : 'chats.empty.title')}</p>
            {!searching && <p className="mt-1 max-w-64 text-sm text-muted-foreground">{t('chats.empty.hint')}</p>}
          </div>
        ) : (
          CHATS.map((chat) => <ChatListRow key={chat.id} chat={chat} active={chat.id === activeId} />)
        )}
      </div>
    </div>
  )
}

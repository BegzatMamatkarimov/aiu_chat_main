import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, RouterProvider, createMemoryRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import type { User } from '@supabase/supabase-js'
import './prototype.css'
import { GlassBackground } from '@/components/glass/glass-background'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { AppShell } from '@/features/chats/app-shell'
import { ChatListDataContext } from '@/features/chats/chat-list-data'
import { EmptyChat } from '@/features/chats/empty-chat'
import { DemoChat } from './demo-chat'
import { CHATS } from './demo-data'

const VARIANTS = [
  { id: 'indigo-white', name: 'Белый', title: 'Белый + индиго', note: 'Чистый фон, индиго-пузыри, орнамент вместо узора, бирюза для непрочитанных и ссылок' },
  { id: 'lavender-glass', name: 'Лаванда', title: 'Лавандовое стекло', note: 'Стекло как сейчас, но mesh из индиго и лаванды с каплей бирюзы, без розового' },
  { id: 'indigo-header', name: 'Шапка', title: 'Индиго-шапка', note: 'Как на сайте: сплошные индиго-шапки, белый контент, лента орнамента' },
] as const

function initialIndex(): number {
  const n = parseInt(new URLSearchParams(location.search).get('v') ?? '', 10)
  return n >= 1 && n <= VARIANTS.length ? n - 1 : 0
}

function Picker({
  current,
  onSelect,
  onReplay,
}: {
  current: number
  onSelect: (i: number) => void
  onReplay: () => void
}) {
  const navRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[current]
    const hl = highlightRef.current
    if (!el || !hl) return
    hl.style.width = `${el.offsetWidth}px`
    hl.style.transform = `translateX(${el.offsetLeft}px)`
  }, [current])

  useLayoutEffect(moveHighlight, [moveHighlight])

  useEffect(() => {
    window.addEventListener('resize', moveHighlight)
    return () => window.removeEventListener('resize', moveHighlight)
  }, [moveHighlight])

  useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => navRef.current?.setAttribute('data-ready', ''))
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [])

  return (
    <nav ref={navRef} className="proto-picker" data-position="top" aria-label="Prototype variants">
      <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
      {VARIANTS.map((v, i) => (
        <button
          key={v.name}
          ref={(el) => {
            itemRefs.current[i] = el
          }}
          type="button"
          className="proto-picker-item"
          data-active={i === current ? '' : undefined}
          aria-current={i === current ? 'true' : undefined}
          onClick={() => onSelect(i)}
        >
          {v.name}
        </button>
      ))}
      <span className="proto-picker-divider" aria-hidden="true" />
      <button type="button" className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={onReplay}>
        ↻
      </button>
    </nav>
  )
}

const DEMO_AUTH: AuthContextValue = {
  session: null,
  user: { id: 'demo', email: 'alikhan@aiu.kz' } as User,
  initializing: false,
  profile: { id: 'demo', username: 'alikhan', display_name: 'Алихан Сериков', avatar_url: null, course: 2, major: 'IT', locale: 'ru', created_at: '' },
  profileLoading: false,
  refetchProfile: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
}

function startPath(): string {
  const screen = new URLSearchParams(location.search).get('screen')
  if (screen === 'chat') return '/c/alg'
  if (screen === 'list') return '/'
  return window.matchMedia('(min-width: 768px)').matches ? '/c/alg' : '/'
}

// Открытый экран переживает смену варианта и «replay».
let lastPath = startPath()

/**
 * Настоящий каркас приложения (AppShell, список, шапка) с демо-данными в отдельном корне React:
 * внешний роутер страницы прототипов нельзя вкладывать в другой, а памяти-роутер нужен для /c/:chatId.
 */
function DemoApp({ nonce }: { nonce: number }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    const host = document.createElement('div')
    host.className = 'h-full'
    parent.append(host)
    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <EmptyChat /> },
            { path: 'c/:chatId', element: <DemoChat /> },
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
      { initialEntries: [lastPath] },
    )
    const unsubscribe = router.subscribe((s) => {
      lastPath = s.location.pathname
    })
    const root = createRoot(host)
    root.render(
      <MotionConfig reducedMotion="user">
        <AuthContext.Provider value={DEMO_AUTH}>
          <ChatListDataContext.Provider value={CHATS}>
            <div className="relative isolate h-full overflow-hidden text-foreground">
              <GlassBackground />
              <RouterProvider router={router} />
            </div>
          </ChatListDataContext.Provider>
        </AuthContext.Provider>
      </MotionConfig>,
    )
    return () => {
      unsubscribe()
      queueMicrotask(() => {
        root.unmount()
        router.dispose()
        host.remove()
      })
    }
  }, [nonce])

  return <div ref={hostRef} className="proto-stage min-h-0 flex-1" />
}

export function HomePrototype() {
  const [current, setCurrent] = useState(initialIndex)
  const [nonce, setNonce] = useState(0)
  const [dark, setDark] = useState(false)

  const select = useCallback((i: number) => {
    if (i < 0 || i >= VARIANTS.length) return
    setCurrent(i)
    setNonce((n) => n + 1)
    const url = new URL(location.href)
    url.searchParams.set('v', String(i + 1))
    history.replaceState(null, '', url)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= VARIANTS.length) select(num - 1)
      else if (e.key === 'ArrowRight') select((current + 1) % VARIANTS.length)
      else if (e.key === 'ArrowLeft') select((current - 1 + VARIANTS.length) % VARIANTS.length)
      else if (e.key === 'r' || e.key === 'R') setNonce((n) => n + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, select])

  // Вариант светлой палитры — атрибут на корневом элементе; тема прототипа принудительная.
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.dataset.light = VARIANTS[current].id
    root.classList.toggle('dark', dark)
    return () => {
      delete root.dataset.light
      root.classList.toggle('dark', wasDark)
    }
  }, [current, dark])

  // Полноэкранный каркас: без прокрутки страницы, работает env(safe-area-inset-*).
  useEffect(() => {
    document.documentElement.classList.add('proto-lock')
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const prev = meta?.content
    if (meta && !meta.content.includes('viewport-fit')) meta.content = `${meta.content}, viewport-fit=cover`
    return () => {
      document.documentElement.classList.remove('proto-lock')
      if (meta && prev !== undefined) meta.content = prev
    }
  }, [])

  const variant = VARIANTS[current]

  return (
    <div className="proto-root flex h-dvh flex-col bg-background text-foreground">
      <div className="proto-panel relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-background px-3 pb-2 pt-[4.25rem] md:h-16 md:flex-nowrap md:py-0">
        <p className="min-w-0 truncate text-xs md:max-w-[calc(50%-9rem)] md:text-sm">
          <span className="font-semibold">{variant.title}</span>
          <span className="hidden text-muted-foreground lg:inline"> — {dark ? 'тёмная тема не меняется' : variant.note}</span>
        </p>
        <div role="group" aria-label="Тема прототипа" className="proto-theme flex shrink-0 rounded-full border p-0.5 text-xs font-medium">
          {([false, true] as const).map((isDark) => (
            <button
              key={String(isDark)}
              type="button"
              aria-pressed={dark === isDark}
              onClick={() => setDark(isDark)}
              className={`h-6 rounded-full px-3 ${dark === isDark ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >
              {isDark ? 'Тёмная' : 'Светлая'}
            </button>
          ))}
        </div>
      </div>
      <DemoApp nonce={nonce} />
      <Picker current={current} onSelect={select} onReplay={() => setNonce((n) => n + 1)} />
    </div>
  )
}

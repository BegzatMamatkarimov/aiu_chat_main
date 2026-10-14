import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { MotionConfig } from 'motion/react'
import './prototype.css'
import { VariantGlass } from './variant-glass'
import { VariantVivid } from './variant-vivid'
import { VariantMotion } from './variant-motion'

const VARIANTS: { name: string; Component: ComponentType }[] = [
  { name: 'Стекло', Component: VariantGlass },
  { name: 'Неон', Component: VariantVivid },
  { name: 'Живой', Component: VariantMotion },
]

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

export function HomePrototype() {
  const [current, setCurrent] = useState(initialIndex)
  const [nonce, setNonce] = useState(0)

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

  // Full-screen app shell: lock page scroll and let env(safe-area-inset-*) work.
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

  const { Component } = VARIANTS[current]

  return (
    <MotionConfig reducedMotion="user">
      <div className="proto-root flex h-dvh flex-col bg-background text-foreground">
        <div className="h-16 shrink-0 border-b bg-muted/60" aria-hidden="true" />
        <div className="min-h-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <Component key={`${current}-${nonce}`} />
        </div>
        <Picker current={current} onSelect={select} onReplay={() => setNonce((n) => n + 1)} />
      </div>
    </MotionConfig>
  )
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { getPreview, useSignedUrl } from '@/features/messages/media-url'

const HIST_KEY = 'aiuViewer'

function Slide({ path, index, onBackdrop }: { path: string; index: number; onBackdrop: () => void }) {
  const q = useSignedUrl(path)
  const src = q.data ?? getPreview(path)
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onBackdrop()}
      className="flex h-full w-full shrink-0 snap-center items-center justify-center"
    >
      {src && <img src={src} alt="" data-index={index} draggable={false} className="max-h-full max-w-full object-contain" />}
    </div>
  )
}

/** Полноэкранный просмотр: чёрный непрозрачный фон, без анимации появления. Системное «назад» закрывает его через запись в истории. */
export function PhotoViewer({ paths, start, onClose }: { paths: readonly string[]; start: number; onClose: () => void }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [idx, setIdx] = useState(start)
  const cur = paths[idx] ?? paths[0]
  const signed = useSignedUrl(cur).data

  const close = useCallback(() => {
    if (history.state?.[HIST_KEY]) history.back()
    else onClose()
  }, [onClose])

  useEffect(() => {
    if (!history.state?.[HIST_KEY]) history.pushState({ ...history.state, [HIST_KEY]: 1 }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  useLayoutEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = start * el.clientWidth
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeBtn.current?.focus({ preventScroll: true })
    return () => prev?.focus({ preventScroll: true })
  }, [start])

  const go = useCallback((d: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: el.scrollLeft + d * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, go])

  const many = paths.length > 1
  const ext = cur.split('.').pop() ?? 'jpg'
  const download = signed ? `${signed}${signed.includes('?') ? '&' : '?'}download=${encodeURIComponent(`aiu-photo-${idx + 1}.${ext}`)}` : null
  const btn = 'glass-viewer-btn absolute flex size-11 items-center justify-center rounded-full'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('chat.media.viewer')} className="glass-viewer fixed inset-0 z-[300]">
      <div
        ref={track}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="glass-viewer-track flex h-full w-full snap-x snap-mandatory overflow-x-auto"
      >
        {paths.map((p, i) => (
          <Slide key={p} path={p} index={i} onBackdrop={close} />
        ))}
      </div>
      <button
        ref={closeBtn}
        type="button"
        onClick={close}
        aria-label={t('chat.media.close')}
        className={btn}
        style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}
      >
        <X className="size-6" />
      </button>
      {many && (
        <span
          className="glass-viewer-btn absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums"
          style={{ top: 'max(1rem, calc(env(safe-area-inset-top) + 0.25rem))' }}
        >
          {t('chat.media.counter', { current: idx + 1, total: paths.length })}
        </span>
      )}
      {many && idx > 0 && (
        <button type="button" onClick={() => go(-1)} aria-label={t('chat.media.prev')} className={`${btn} left-3 top-1/2 hidden -translate-y-1/2 pointer-fine:flex`}>
          <ChevronLeft className="size-6" />
        </button>
      )}
      {many && idx < paths.length - 1 && (
        <button type="button" onClick={() => go(1)} aria-label={t('chat.media.next')} className={`${btn} right-3 top-1/2 hidden -translate-y-1/2 pointer-fine:flex`}>
          <ChevronRight className="size-6" />
        </button>
      )}
      {download && (
        <a
          href={download}
          download
          aria-label={t('chat.media.download')}
          className="glass-viewer-btn absolute left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-sm font-semibold"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <Download className="size-5" />
          {t('chat.media.download')}
        </a>
      )}
    </div>,
    document.body,
  )
}

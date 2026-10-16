import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react'
import { getPreview, useSignedUrl } from '@/features/messages/media-url'
import type { MessageAttachment } from '@/features/messages/message-model'
import { barHeights, formatDuration } from '@/features/messages/voice-utils'

/** Одновременно играет одно голосовое. */
let current: { pause: () => void } | null = null

function Bars({ heights }: { heights: number[] }) {
  return (
    <>
      {heights.map((h, i) => (
        <span key={i} className="w-[3px] shrink-0 rounded-full bg-current" style={{ height: `${h}%` }} />
      ))}
    </>
  )
}

export function MessageVoice({ att, msgId, sent }: { att: MessageAttachment; msgId: string; sent: boolean }) {
  const { t } = useTranslation()
  const total = att.durationMs ?? 0
  const heights = useMemo(() => barHeights(msgId), [msgId])

  const [wanted, setWanted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const preview = getPreview(att.storagePath)
  const signed = useSignedUrl(att.storagePath, wanted && sent && !preview)
  const src = preview ?? signed.data

  const audio = useRef<HTMLAudioElement | null>(null)
  const want = useRef(false)
  const seekTo = useRef<number | null>(null)
  const raf = useRef(0)
  const fill = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const slider = useRef<HTMLDivElement>(null)
  const self = useRef({ pause: () => audio.current?.pause() })

  const paint = useCallback(
    (ratio: number) => {
      const r = Math.min(1, Math.max(0, ratio))
      if (fill.current) fill.current.style.clipPath = `inset(0 ${((1 - r) * 100).toFixed(1)}% 0 0)`
      const pct = String(Math.round(r * 100))
      if (slider.current && slider.current.getAttribute('aria-valuenow') !== pct) slider.current.setAttribute('aria-valuenow', pct)
      if (label.current) label.current.textContent = formatDuration(r > 0 ? r * total : total)
    },
    [total],
  )

  const startLoop = useCallback(() => {
    const step = () => {
      const a = audio.current
      if (a && total > 0) paint(a.currentTime / (total / 1000))
      raf.current = requestAnimationFrame(step)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(step)
  }, [paint, total])

  const fail = useCallback(() => {
    audio.current = null
    want.current = false
    setLoading(false)
    setPlaying(false)
    setError(true)
    toast.error(t('chat.voice.playError'))
  }, [t])

  const playFail = useCallback(
    (e: unknown) => {
      if (!(e instanceof DOMException && e.name === 'AbortError')) fail()
    },
    [fail],
  )

  const begin = useCallback(
    (url: string) => {
      const a = audio.current
      if (!a) return
      a.src = url
      if (seekTo.current !== null) {
        const at = seekTo.current
        a.addEventListener('loadedmetadata', () => (a.currentTime = at), { once: true })
        seekTo.current = null
      }
      a.play().catch(playFail)
    },
    [playFail],
  )

  const toggle = () => {
    if (!sent) return
    const a = audio.current
    if (a && !a.paused) return a.pause()
    setError(false)
    current?.pause()
    current = self.current
    if (a) {
      a.play().catch(playFail)
      return
    }
    const el = new Audio()
    el.preload = 'none'
    el.onplay = () => {
      setPlaying(true)
      startLoop()
    }
    el.onplaying = () => setLoading(false)
    el.onwaiting = () => setLoading(true)
    el.onpause = () => {
      setPlaying(false)
      cancelAnimationFrame(raf.current)
    }
    el.onended = () => {
      el.currentTime = 0
      setPlaying(false)
      cancelAnimationFrame(raf.current)
      paint(0)
    }
    el.onerror = fail
    audio.current = el
    want.current = true
    setLoading(true)
    setWanted(true)
    if (src) begin(src)
    else if (signed.isError) void signed.refetch()
  }

  // Ссылка пришла после тапа (подписанный URL) — запускаем.
  useEffect(() => {
    if (want.current && audio.current && !audio.current.src && src) begin(src)
  }, [src, begin])
  useEffect(() => {
    if (wanted && signed.isError && want.current) fail()
  }, [wanted, signed.isError, fail])

  useEffect(() => {
    const me = self.current
    return () => {
      cancelAnimationFrame(raf.current)
      const a = audio.current
      if (a) {
        a.onpause = a.onended = a.onerror = a.onplay = a.onplaying = a.onwaiting = null
        a.pause()
      }
      if (current === me) current = null
    }
  }, [])

  const seekFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    seekRatio((e.clientX - r.left) / r.width)
  }
  const seekRatio = (ratio: number) => {
    const r = Math.min(1, Math.max(0, ratio))
    paint(r)
    if (total <= 0) return
    const a = audio.current
    if (a && a.src) a.currentTime = r * (total / 1000)
    else seekTo.current = r * (total / 1000)
  }
  const onKey = (e: KeyboardEvent) => {
    const a = audio.current
    const now = a && total > 0 ? a.currentTime / (total / 1000) : (seekTo.current ?? 0) / Math.max(total / 1000, 1)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seekRatio(now + 0.05)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seekRatio(now - 0.05)
    else return
    e.preventDefault()
  }

  const Icon = !sent || loading ? LoaderCircle : error ? RotateCcw : playing ? Pause : Play
  return (
    <div className="flex w-[min(240px,62vw)] items-center gap-2.5 py-0.5 md:w-60">
      <button
        type="button"
        onClick={toggle}
        disabled={!sent}
        aria-label={error ? t('chat.voice.retry') : playing ? t('chat.voice.pause') : t('chat.voice.play')}
        className="glass-voice-btn glass-press flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <Icon aria-hidden="true" className={`size-5 ${!sent || loading ? 'animate-spin motion-reduce:animate-none' : ''}`} fill={Icon === Play || Icon === Pause ? 'currentColor' : 'none'} />
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={slider}
          role="slider"
          tabIndex={0}
          aria-label={t('chat.voice.seek')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            seekFromEvent(e)
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && seekFromEvent(e)}
          className="relative flex h-7 cursor-pointer touch-none items-center justify-between rounded-sm opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-between opacity-35">
            <Bars heights={heights} />
          </div>
          <div ref={fill} aria-hidden="true" className="absolute inset-0 flex items-center justify-between" style={{ clipPath: 'inset(0 100% 0 0)' }}>
            <Bars heights={heights} />
          </div>
        </div>
        <span ref={label} className="block text-xs tabular-nums leading-none opacity-80">
          {formatDuration(total)}
        </span>
      </div>
    </div>
  )
}

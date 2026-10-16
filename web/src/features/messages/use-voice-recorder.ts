import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { VoiceClip } from '@/features/messages/send-message'

export const MAX_VOICE_MS = 60_000
export const MIN_VOICE_MS = 1_000

const FORMATS = [
  { type: 'audio/mp4', mime: 'audio/mp4', ext: 'm4a' },
  { type: 'audio/webm;codecs=opus', mime: 'audio/webm', ext: 'webm' },
  { type: 'audio/webm', mime: 'audio/webm', ext: 'webm' },
]

export type VoiceState = 'idle' | 'recording' | 'ready'

type Session = {
  stream: MediaStream
  rec: MediaRecorder
  chunks: Blob[]
  fmt: (typeof FORMATS)[number] | null
  t0: number
  durationMs: number
  ctx: AudioContext | null
  raf: number
  stopped: Promise<void>
  clip: VoiceClip | null
}

/** Запись голосового: MediaRecorder, остановка по 60 с / сворачиванию вкладки, живой уровень сигнала без React-рендеров. */
export function useVoiceRecorder() {
  const { t } = useTranslation()
  const [state, setState] = useState<VoiceState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const session = useRef<Session | null>(null)
  const starting = useRef(false)
  const level = useRef<HTMLSpanElement | null>(null)

  const release = useCallback((s: Session) => {
    cancelAnimationFrame(s.raf)
    s.stream.getTracks().forEach((tr) => tr.stop())
    void s.ctx?.close().catch(() => undefined)
    s.ctx = null
    if (level.current) level.current.style.transform = 'scaleX(0)'
  }, [])

  const stop = useCallback(() => {
    const s = session.current
    if (!s || s.rec.state === 'inactive') return s?.stopped ?? Promise.resolve()
    s.durationMs = Math.round(performance.now() - s.t0)
    setElapsed(s.durationMs)
    s.rec.stop()
    release(s)
    setState('ready')
    return s.stopped
  }, [release])

  const cancel = useCallback(() => {
    const s = session.current
    session.current = null
    if (s) {
      if (s.rec.state !== 'inactive') s.rec.stop()
      release(s)
    }
    setState('idle')
    setElapsed(0)
  }, [release])

  const start = useCallback(async () => {
    if (starting.current || session.current) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(t('chat.voice.unsupported'))
      return
    }
    starting.current = true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      starting.current = false
      toast.error(t('chat.voice.noAccess'))
      return
    }
    try {
      const fmt = FORMATS.find((f) => MediaRecorder.isTypeSupported(f.type)) ?? null
      const rec = fmt ? new MediaRecorder(stream, { mimeType: fmt.type }) : new MediaRecorder(stream)
      const chunks: Blob[] = []
      let done: () => void = () => undefined
      const stopped = new Promise<void>((r) => (done = r))
      const s: Session = { stream, rec, chunks, fmt, t0: 0, durationMs: 0, ctx: null, raf: 0, stopped, clip: null }
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = () => {
        const mime = fmt?.mime ?? (rec.mimeType || 'audio/webm').split(';')[0]
        const ext = fmt?.ext ?? (mime === 'audio/mp4' ? 'm4a' : 'webm')
        s.clip = { blob: new Blob(chunks, { type: mime }), mime, ext, durationMs: s.durationMs }
        done()
      }
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctx) {
          const ctx = new Ctx()
          const an = ctx.createAnalyser()
          an.fftSize = 256
          ctx.createMediaStreamSource(stream).connect(an)
          s.ctx = ctx
          const buf = new Uint8Array(an.fftSize)
          const tick = () => {
            an.getByteTimeDomainData(buf)
            let peak = 0
            for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
            if (level.current) level.current.style.transform = `scaleX(${Math.min(1, (peak / 128) * 2.2).toFixed(3)})`
            s.raf = requestAnimationFrame(tick)
          }
          tick()
        }
      } catch {
        // индикатор уровня необязателен
      }
      s.t0 = performance.now()
      rec.start()
      session.current = s
      setElapsed(0)
      setState('recording')
    } catch {
      stream.getTracks().forEach((tr) => tr.stop())
      toast.error(t('chat.voice.unsupported'))
    }
    starting.current = false
  }, [t])

  // Таймер и автоостановка на 60 с.
  useEffect(() => {
    if (state !== 'recording') return
    const id = window.setInterval(() => {
      const s = session.current
      if (!s) return
      const ms = performance.now() - s.t0
      if (ms >= MAX_VOICE_MS) {
        s.t0 = performance.now() - MAX_VOICE_MS
        void stop()
        toast(t('chat.voice.maxReached'))
      } else setElapsed(ms)
    }, 200)
    return () => window.clearInterval(id)
  }, [state, stop, t])

  // Вкладка свёрнута: останавливаем запись, она остаётся готовой к отправке.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && session.current?.rec.state === 'recording' && void stop()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [stop])

  useEffect(() => cancel, [cancel])

  /** Завершает запись и отдаёт клип (null — слишком короткий, запись отменена). */
  const finish = useCallback(async (): Promise<VoiceClip | null> => {
    const s = session.current
    if (!s) return null
    await stop()
    const clip = s.clip
    cancel()
    if (!clip || clip.durationMs < MIN_VOICE_MS) {
      toast.error(t('chat.voice.tooShort'))
      return null
    }
    return clip
  }, [stop, cancel, t])

  return { state, elapsed, level, start, cancel, finish }
}

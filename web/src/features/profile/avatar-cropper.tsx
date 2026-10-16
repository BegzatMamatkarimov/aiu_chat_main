import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import { ResponsiveSheet } from '@/components/glass/responsive-sheet'
import { Button } from '@/components/ui/button'
import { DialogDescription } from '@/components/ui/dialog'

const FRAME = 260
const OUT = 512
const MAX_SOURCE = 15 * 1024 * 1024
const MAX_ZOOM = 4

type View = { zoom: number; x: number; y: number }

function clampView(v: View, w: number, h: number): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom))
  const k = (FRAME / Math.min(w, h)) * zoom
  const mx = Math.max(0, (w * k - FRAME) / 2)
  const my = Math.max(0, (h * k - FRAME) / 2)
  return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) }
}

function CropEditor({
  file,
  bmp,
  onCancel,
  onDone,
}: {
  file: File
  bmp: ImageBitmap
  onCancel: () => void
  onDone: (blob: Blob) => void
}) {
  const { t } = useTranslation()
  const { width: w, height: h } = bmp
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const sliderRef = useRef<HTMLInputElement>(null)
  const k = (FRAME / Math.min(w, h)) * view.zoom
  const update = (fn: (v: View) => View) => setView((v) => clampView(fn(v), w, h))

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (before > 0) update((v) => ({ ...v, zoom: v.zoom * (after / before) }))
    } else {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      update((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
  }
  const wheel = (e: WheelEvent<HTMLDivElement>) => update((v) => ({ ...v, zoom: v.zoom * Math.exp(-e.deltaY * 0.002) }))

  const finish = async () => {
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = OUT
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, OUT, OUT)
      ctx.imageSmoothingQuality = 'high'
      const side = FRAME / k
      ctx.drawImage(bmp, w / 2 - view.x / k - side / 2, h / 2 - view.y / k - side / 2, side, side, 0, 0, OUT, OUT)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
      if (!blob) throw new Error('no blob')
      onDone(blob)
    } catch {
      toast.error(t('avatar.unsupported'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
      <DialogDescription id="avatar-crop-hint" className="sr-only">
        {t('avatar.hint')}
      </DialogDescription>
      <div
        data-testid="crop-frame"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        style={{ width: FRAME, height: FRAME, touchAction: 'none' }}
        className="relative shrink-0 cursor-grab select-none overflow-hidden rounded-2xl bg-black active:cursor-grabbing"
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ position: 'absolute', maxWidth: 'none', width: w * k, height: h * k, left: FRAME / 2 - (w * k) / 2 + view.x, top: FRAME / 2 - (h * k) / 2 + view.y }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 400px rgba(0,0,0,0.55)', outline: '2px solid rgba(255,255,255,0.8)', outlineOffset: -1 }} />
      </div>
      <label className="flex w-full max-w-[260px] items-center gap-3 text-sm text-muted-foreground">
        <span>{t('avatar.zoom')}</span>
        <input
          ref={sliderRef}
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(e) => update((v) => ({ ...v, zoom: Number(e.target.value) }))}
          className="min-w-0 flex-1 accent-[var(--primary)]"
        />
      </label>
      <div className="flex w-full gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11 flex-1 text-base" onClick={onCancel} disabled={busy}>
          {t('avatar.cancel')}
        </Button>
        <Button type="button" size="lg" className="h-11 flex-1 text-base" onClick={() => void finish()} disabled={busy} aria-busy={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {t('avatar.done')}
        </Button>
      </div>
    </div>
  )
}

/** Кнопка «Изменить фото»: выбор файла и окно кадрирования. */
export function AvatarCropper({ onCropped, disabled }: { onCropped: (blob: Blob) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const focusRef = useRef<HTMLElement>(null)
  const [source, setSource] = useState<{ file: File; bmp: ImageBitmap } | null>(null)

  const close = () => {
    setSource((s) => {
      s?.bmp.close()
      return null
    })
  }

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!file) return
    if (file.size > MAX_SOURCE) return void toast.error(t('avatar.tooLarge'))
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      setSource({ file, bmp })
    } catch {
      toast.error(t('avatar.unsupported'))
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled}>
        <Camera />
        {t('avatar.change')}
      </Button>
      <ResponsiveSheet
        open={!!source}
        onOpenChange={(o) => !o && close()}
        title={t('avatar.title')}
        closeLabel={t('chats.create.close')}
        describedBy="avatar-crop-hint"
        focusRef={focusRef}
        sheetKey="avatar-crop"
      >
        {source && (
          <CropEditor
            file={source.file}
            bmp={source.bmp}
            onCancel={close}
            onDone={(blob) => {
              onCropped(blob)
              close()
            }}
          />
        )}
      </ResponsiveSheet>
    </>
  )
}

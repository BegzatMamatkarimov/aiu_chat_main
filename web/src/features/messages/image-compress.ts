export const MAX_SIDE = 1600
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_PHOTOS = 10

export type PreparedImage = { blob: Blob; mime: string; width: number; height: number; size: number }

export class MediaError extends Error {
  code: 'unsupported' | 'tooLarge'
  constructor(code: 'unsupported' | 'tooLarge') {
    super(code)
    this.code = code
  }
}

const KEEP = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function extOf(mime: string) {
  return mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'bin'
}

/** Сжатие в браузере: длинная сторона до 1600 px, JPEG 0.82; GIF не трогаем; исходник остаётся, если он не больше результата. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith('image/')) throw new MediaError('unsupported')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new MediaError('unsupported')
  }
  try {
    const { width: w, height: h } = bmp
    const canKeep = KEEP.includes(file.type) && file.size <= MAX_PHOTO_BYTES
    if (file.type === 'image/gif') {
      if (!canKeep) throw new MediaError('tooLarge')
      return { blob: file, mime: file.type, width: w, height: h, size: file.size }
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new MediaError('unsupported')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(bmp, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob) throw new MediaError('unsupported')
    if (canKeep && blob.size >= file.size) return { blob: file, mime: file.type, width: w, height: h, size: file.size }
    if (blob.size > MAX_PHOTO_BYTES) throw new MediaError('tooLarge')
    return { blob, mime: 'image/jpeg', width: cw, height: ch, size: blob.size }
  } finally {
    bmp.close()
  }
}

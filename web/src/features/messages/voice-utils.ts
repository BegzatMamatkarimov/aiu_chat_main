const BARS = 28

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Одинаковые на всех устройствах высоты столбиков (10–100 %) из id сообщения. */
export function barHeights(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out: number[] = []
  for (let i = 0; i < BARS; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    out.push(14 + (((h ^ (h >>> 16)) >>> 0) % 87))
  }
  return out
}

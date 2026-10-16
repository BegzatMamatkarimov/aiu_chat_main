import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const MEDIA_BUCKET = 'chat-media'
const TTL = 3600

type Waiter = { path: string; resolve: (url: string) => void; reject: (e: Error) => void }
let queue: Waiter[] = []

async function flush() {
  const batch = queue
  queue = []
  try {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls([...new Set(batch.map((b) => b.path))], TTL)
    if (error) throw error
    const byPath = new Map(data.map((d) => [d.path, d]))
    for (const w of batch) {
      const d = byPath.get(w.path)
      if (d?.signedUrl) w.resolve(d.signedUrl)
      else w.reject(new Error(d?.error ?? 'sign failed'))
    }
  } catch (e) {
    for (const w of batch) w.reject(e instanceof Error ? e : new Error('sign failed'))
  }
}

/** Подписанные ссылки собираются в один запрос createSignedUrls. */
function sign(path: string) {
  return new Promise<string>((resolve, reject) => {
    queue.push({ path, resolve, reject })
    if (queue.length === 1) setTimeout(() => void flush(), 20)
  })
}

export function useSignedUrl(path: string | null, enabled = true) {
  return useQuery({
    queryKey: ['signed-url', path],
    queryFn: () => sign(path ?? ''),
    enabled: !!path && enabled,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  })
}

/** Локальные blob-URL только что отправленных фото: показываются, пока не загрузилась серверная картинка. */
const previews = new Map<string, string>()

export function setPreview(path: string, url: string) {
  previews.set(path, url)
}
export function getPreview(path: string) {
  return previews.get(path)
}
export function releasePreview(path: string) {
  const url = previews.get(path)
  if (!url) return
  previews.delete(path)
  URL.revokeObjectURL(url)
}

import { supabase } from '@/lib/supabase'

const BUCKET = 'avatars'

/** Загружает JPEG в свою папку `<user_id>/<name>` (уникальное имя против кэша) и возвращает путь и публичный URL. */
export async function uploadAvatar(userId: string, name: string, blob: Blob) {
  const path = `${userId}/${name}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

export function removeAvatarObject(path: string) {
  return supabase.storage.from(BUCKET).remove([path]).then(
    () => undefined,
    () => undefined,
  )
}

/** Удаляет старый объект, только если он лежит в папке пользователя; ошибки игнорируются. */
export function removeOwnAvatar(userId: string, url: string | null | undefined) {
  if (!url) return Promise.resolve()
  const marker = `/${BUCKET}/${userId}/`
  const i = url.indexOf(marker)
  if (i < 0) return Promise.resolve()
  const path = `${userId}/${decodeURIComponent(url.slice(i + marker.length).split('?')[0])}`
  return removeAvatarObject(path)
}

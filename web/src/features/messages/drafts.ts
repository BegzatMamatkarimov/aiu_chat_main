const PREFIX = 'aiu-chat-draft:'
const mem = new Map<string, string>()
let timer: number | undefined
let dirty = new Set<string>()

function storage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const keyOf = (userId: string, chatId: string) => `${PREFIX}${userId}:${chatId}`

function flush() {
  window.clearTimeout(timer)
  timer = undefined
  const s = storage()
  const keys = dirty
  dirty = new Set()
  if (!s) return
  try {
    for (const k of keys) {
      const v = mem.get(k)
      if (v) s.setItem(k, v)
      else s.removeItem(k)
    }
  } catch {
    // квота или запрет хранилища: черновик останется только в памяти
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

/** Черновик чата: память + sessionStorage (переживает перезагрузку вкладки, но не закрытие). */
export function getDraft(userId: string, chatId: string): string {
  const k = keyOf(userId, chatId)
  const cached = mem.get(k)
  if (cached !== undefined) return cached
  let v = ''
  try {
    v = storage()?.getItem(k) ?? ''
  } catch {
    v = ''
  }
  mem.set(k, v)
  return v
}

export function setDraft(userId: string, chatId: string, text: string) {
  const k = keyOf(userId, chatId)
  mem.set(k, text)
  dirty.add(k)
  window.clearTimeout(timer)
  timer = window.setTimeout(flush, 300)
}

export function flushDrafts() {
  flush()
}

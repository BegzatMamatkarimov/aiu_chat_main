const RELOAD_KEY = 'aiu-chunk-reload-at'
const RELOAD_INTERVAL_MS = 10_000

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed/i

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  return name === 'ChunkLoadError' || CHUNK_ERROR_PATTERN.test(message)
}

/** Один автоперезагруз при сбое загрузки чанка (не чаще раза в 10 с), дальше показывается экран ошибки. */
export function installChunkReloadHandler() {
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    } catch {
      // storage unavailable
    }
    if (Date.now() - last < RELOAD_INTERVAL_MS) return
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      return
    }
    event.preventDefault()
    window.location.reload()
  })
}

/** Копирование в буфер; запасной путь для окон без доступа к Clipboard API (http, старые браузеры). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(area)
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    active?.focus({ preventScroll: true })
    return ok
  }
}

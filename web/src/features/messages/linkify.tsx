import type { ReactNode } from 'react'

const URL_RE = /https?:\/\/[^\s<>]+/gi
const TRAILING = /[.,!?;:)\]}»"'…]+$/

function safeHref(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** Текст с кликабельными http/https-ссылками. Без dangerouslySetInnerHTML; пунктуация в конце ссылки остаётся текстом. */
export function Linkified({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let from = 0
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '')
    const href = safeHref(url)
    if (!href) continue
    if (m.index > from) nodes.push(text.slice(from, m.index))
    nodes.push(
      <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className="glass-link underline underline-offset-2">
        {url}
      </a>,
    )
    from = m.index + url.length
  }
  if (from < text.length) nodes.push(text.slice(from))
  return <>{nodes}</>
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0])
  return letters.join('').toUpperCase() || '?'
}

/** Детерминированный оттенок аватара по строке (id чата); градиент задаёт .glass-av. */
export function hueOf(key: string) {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) % 360
  return h
}

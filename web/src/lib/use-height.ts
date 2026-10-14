import { useLayoutEffect, useState, type RefObject } from 'react'

export function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [ref])
  return h
}

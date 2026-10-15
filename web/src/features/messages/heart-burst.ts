import { touchDebug } from '@/features/messages/touch-debug'

/** «Вспышка» сердца над пузырём (двойной тап): transform и opacity, элемент убирается по окончании. */
export function playHeartBurst(bubble: HTMLElement, t0: number) {
  const host = bubble.parentElement
  if (!host) return
  const el = document.createElement('span')
  el.setAttribute('aria-hidden', 'true')
  el.textContent = '❤️'
  el.className = 'pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-6 -mt-6 flex size-12 items-center justify-center text-[2.5rem] leading-none'
  host.appendChild(el)
  touchDebug.heart(t0)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setTimeout(() => el.remove(), 350)
    return
  }
  const a = el.animate(
    [
      { transform: 'scale(0.6)', opacity: 0 },
      { transform: 'scale(1.1)', opacity: 1, offset: 0.4 },
      { transform: 'scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 350, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  )
  a.onfinish = () => el.remove()
  a.oncancel = () => el.remove()
}

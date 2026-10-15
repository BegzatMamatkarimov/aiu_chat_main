import { useEffect, type RefObject } from 'react'

const KEYBOARD_MIN_PX = 120

/**
 * Телефон: экранная клавиатура сужает видимую область (visualViewport), а страница может сдвинуться.
 * Пока клавиатура открыта, прижимаем элемент к видимой области: высота = высота viewport, смещение = его offsetTop.
 * Так шапка остаётся наверху, а поле ввода — над клавиатурой. На компьютере и без клавиатуры ничего не делает.
 */
export function useKeyboardFit(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!enabled || !vv || !el) return
    const coarse = window.matchMedia('(pointer: coarse)')
    const clear = () => {
      el.style.height = ''
      el.style.transform = ''
    }
    const update = () => {
      const covered = window.innerHeight - vv.height
      if (coarse.matches && vv.scale <= 1.01 && covered > KEYBOARD_MIN_PX) {
        el.style.height = `${Math.round(vv.height)}px`
        el.style.transform = `translateY(${Math.round(vv.offsetTop)}px)`
      } else clear()
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      clear()
    }
  }, [ref, enabled])
}

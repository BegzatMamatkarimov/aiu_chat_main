import { useLayoutEffect, useRef } from 'react'
import { Composer } from '@/features/messages/composer'
import { MessageFeed } from '@/features/messages/message-feed'

/** Лента и поле ввода. Высота поля ввода пишется в --composer-h прямо в DOM: лента отступает от него без перерисовок React. */
export function ChatBody({ chatId, isGroup }: { chatId: string; isGroup: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = root.current
    const el = composer.current
    if (!host || !el) return
    const apply = () => host.style.setProperty('--composer-h', `${el.offsetHeight}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={root} className="absolute inset-0">
      <MessageFeed chatId={chatId} isGroup={isGroup} />
      <div ref={composer} className="absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:px-4">
        <Composer chatId={chatId} />
      </div>
    </div>
  )
}

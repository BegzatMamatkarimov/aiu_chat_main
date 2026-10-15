import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'

/** Подтверждение опасного действия. Пока идёт запрос (`pending`), окно не закрывается. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  note,
  cancelLabel,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  note?: ReactNode
  cancelLabel: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  const change = (next: boolean) => {
    if (!next && pending) return
    onOpenChange(next)
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogPortal>
        <DialogOverlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogContent className="glass-panel pointer-events-auto relative w-[min(24rem,calc(100vw-2rem))] rounded-3xl p-5 text-foreground duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <DialogTitle className="break-words text-lg leading-snug">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">{body}</DialogDescription>
            {note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => change(false)} disabled={pending}>
                {cancelLabel}
              </Button>
              <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending} aria-busy={pending}>
                {pending && <Loader2 className="motion-safe:animate-spin" />}
                {confirmLabel}
              </Button>
            </div>
          </DialogContent>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

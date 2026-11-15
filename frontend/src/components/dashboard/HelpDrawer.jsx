import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import HelpPanel from './HelpPanel'

// Slide-over used by the Overview hero. The help loop is the most human action
// on the board, so it opens from the first screen instead of living at the
// bottom of the scroll. Escape and the backdrop close it.
export default function HelpDrawer({ open, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Ask for help">
      <button type="button" aria-label="Close help" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-space p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Ask for help</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
            aria-label="Close help panel"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <HelpPanel embedded />
      </aside>
    </div>
  )
}

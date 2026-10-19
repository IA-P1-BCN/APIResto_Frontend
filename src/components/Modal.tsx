import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
const FIELDS = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

interface Props {
  label: string
  onClose: () => void
  children: ReactNode
  narrow?: boolean
}

export default function Modal({ label, onClose, children, narrow = false }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const modal = modalRef.current
    const first = modal?.querySelector<HTMLElement>(`.modal-content :is(${FIELDS})`) ?? modal?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-backdrop">
      <div ref={modalRef} className={narrow ? 'modal modal-narrow' : 'modal'} role="dialog" aria-modal="true" aria-label={label} onKeyDown={handleKeyDown}>
        <button type="button" className="btn btn-secondary modal-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}

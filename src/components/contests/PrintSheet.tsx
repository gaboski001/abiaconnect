import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Something to print (a results certificate, voter-code slips). It is hidden
 * on screen; printSheet() prints only this, without the menus and footer.
 */
export function PrintSheet({ id, children }: { id: string; children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="print-sheet" data-sheet={id}>
      {children}
    </div>,
    document.body,
  )
}

export function printSheet(id: string) {
  const body = document.body
  body.classList.add('printing')
  body.dataset.printing = id
  const done = () => {
    body.classList.remove('printing')
    delete body.dataset.printing
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  // Some browsers never fire afterprint; tidy up anyway.
  window.setTimeout(done, 1000)
}

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function useDrawerFocus(aberto: boolean, focoRetorno: RefObject<HTMLElement | null>) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!aberto || !dialog) return
    const overflowAnterior = document.body.style.overflow
    const paddingAnterior = document.body.style.paddingRight
    const larguraScrollbar = window.innerWidth - document.documentElement.clientWidth
    const retorno = focoRetorno.current
    document.body.style.overflow = 'hidden'
    if (larguraScrollbar > 0) {
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight || '0') + larguraScrollbar}px`
    }
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('[data-initial-focus]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = overflowAnterior
      document.body.style.paddingRight = paddingAnterior
      requestAnimationFrame(() => {
        if (dialog.open) return
        if (retorno instanceof HTMLButtonElement && retorno.disabled) {
          document.querySelector<HTMLButtonElement>('.cart-trigger')?.focus()
        } else if (retorno?.isConnected) retorno.focus()
      })
    }
  }, [aberto, focoRetorno])

  function manterFoco(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const elementos = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')]
    const primeiro = elementos[0]
    const ultimo = elementos.at(-1)
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo?.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro?.focus()
    }
  }

  return { dialogRef, manterFoco }
}

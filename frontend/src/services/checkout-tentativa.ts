export const CHECKOUT_PENDING_KEY = 'alva-modas:checkout-pending'
const evento = 'alva-modas:checkout-pending-changed'
let memoria: string | null = null

export function lerTentativaCheckout(): string | null {
  try { memoria = window.localStorage.getItem(CHECKOUT_PENDING_KEY) } catch { return memoria }
  return memoria
}

export function iniciarTentativaCheckout(id: string): void {
  if (lerTentativaCheckout()) throw new Error('Existe uma confirmação em andamento ou com resultado pendente de verificação.')
  window.localStorage.setItem(CHECKOUT_PENDING_KEY, id)
  memoria = id
  window.dispatchEvent(new Event(evento))
}

export function limparTentativaCheckout(id: string): void {
  if (lerTentativaCheckout() !== id) return
  try {
    window.localStorage.removeItem(CHECKOUT_PENDING_KEY)
    memoria = null
  } catch {
    return
  } finally {
    window.dispatchEvent(new Event(evento))
  }
}

export function assinarTentativaCheckout(notificar: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === CHECKOUT_PENDING_KEY || event.key === null) notificar() }
  window.addEventListener('storage', storage)
  window.addEventListener(evento, notificar)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(evento, notificar) }
}

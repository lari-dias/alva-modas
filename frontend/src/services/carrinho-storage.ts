export const CART_STORAGE_KEY = 'alva-modas:cart-id'
const eventoLocal = 'alva-modas:cart-id-changed'
let idEmMemoria: string | null = null
let storageDisponivel = true

export function isCartId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

export function lerCarrinhoId(): string | null {
  if (!storageDisponivel) return idEmMemoria
  try {
    const id = window.localStorage.getItem(CART_STORAGE_KEY)
    idEmMemoria = isCartId(id) ? id : null
  } catch {
    storageDisponivel = false
    return idEmMemoria
  }
  return idEmMemoria
}

export function salvarCarrinhoId(id: string | null): void {
  if (id !== null && !isCartId(id)) throw new Error('Identificador de carrinho inválido.')
  idEmMemoria = id
  try {
    if (id) window.localStorage.setItem(CART_STORAGE_KEY, id)
    else window.localStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    storageDisponivel = false
    return
  } finally {
    window.dispatchEvent(new Event(eventoLocal))
  }
}

export function assinarCarrinhoId(notificar: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === CART_STORAGE_KEY) notificar()
  }
  window.addEventListener('storage', storage)
  window.addEventListener(eventoLocal, notificar)
  return () => {
    window.removeEventListener('storage', storage)
    window.removeEventListener(eventoLocal, notificar)
  }
}

import { isCartId } from './carrinho-storage'

export const CHECKOUT_PENDING_KEY = 'alva-modas:checkout-pending'
const evento = 'alva-modas:checkout-pending-changed'
let memoria: string | null = null

export function lerTentativaCheckout(): string | null {
  try { memoria = window.localStorage.getItem(CHECKOUT_PENDING_KEY) } catch { return memoria }
  return memoria
}

export type TentativaCheckout = { versao: 2; id: string; carrinhoId: string; token: string; autenticada?: boolean }

export function obterTentativaCheckout(): TentativaCheckout | null {
  const valor = lerTentativaCheckout()
  if (!valor) return null
  try {
    const t = JSON.parse(valor) as TentativaCheckout
    return t.versao === 2 && isCartId(t.id) && isCartId(t.carrinhoId) && typeof t.token === 'string' && /^[a-f0-9]{64}$/.test(t.token) ? t : null
  } catch { return null }
}

export function iniciarTentativaCheckout(id: string, autenticada = false): void {
  if (lerTentativaCheckout()) throw new Error('Existe uma confirmação em andamento ou com resultado pendente de verificação.')
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const tentativa: TentativaCheckout = { versao: 2, id: crypto.randomUUID(), carrinhoId: id, token, autenticada }
  const valor = JSON.stringify(tentativa)
  window.localStorage.setItem(CHECKOUT_PENDING_KEY, valor)
  memoria = valor
  window.dispatchEvent(new Event(evento))
}

export function limparTentativaCheckout(id: string, esperado?: string | null): void {
  if (esperado !== undefined && lerTentativaCheckout() !== esperado) return
  if (lerTentativaCheckout() !== id && obterTentativaCheckout()?.carrinhoId !== id) return
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

import { registrarCarrinho } from './carrinho-diagnostico'
import { API_URL } from './api'
import { isProduto } from './produtos'
import { isCartId } from './carrinho-storage'
import type { Carrinho, ItemCarrinho } from '../types/carrinho'

export class ErroCarrinho extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status = 0, code?: string) {
    super(message)
    this.name = 'ErroCarrinho'
    this.status = status
    this.code = code
  }
}

export class CarrinhoExpirado extends ErroCarrinho {
  constructor() {
    super('Seu carrinho expirou ou não existe mais. Comece um novo carrinho e adicione os produtos novamente.', 404, 'CART_NOT_FOUND')
  }
}

const inteiroNaoNegativo = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function isItem(value: unknown): value is ItemCarrinho {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (item.disponivel === undefined || typeof item.disponivel === 'boolean') && isProduto(item.produto) && inteiroNaoNegativo(item.quantidade) && item.quantidade > 0 && inteiroNaoNegativo(item.precoUnitarioCentavos) && inteiroNaoNegativo(item.subtotalCentavos)
}

function isCarrinho(value: unknown): value is Carrinho {
  if (!value || typeof value !== 'object') return false
  const carrinho = value as Record<string, unknown>
  return isCartId(carrinho.idCarrinho) && Array.isArray(carrinho.itens) && carrinho.itens.every(isItem) && inteiroNaoNegativo(carrinho.totalCentavos)
}

async function requisitarCarrinho(method: 'GET' | 'POST' | 'PUT', id?: string, body?: { produtoId: string; quantidade: number }, signal?: AbortSignal): Promise<Carrinho> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (id) headers['X-Cart-Id'] = id
  if (body) headers['Content-Type'] = 'application/json'
  registrarCarrinho(`${method} iniciado`)
  let response: Response
  try {
    response = await fetch(`${API_URL}/carrinho`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    })
  } catch {
    registrarCarrinho('falha de rede ou cancelamento')
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    throw new ErroCarrinho('Não foi possível confirmar a operação. Consulte o carrinho antes de tentar novamente.')
  }
  registrarCarrinho('resposta HTTP', response.status)
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string' ? payload.code : undefined
    if (code === 'CART_NOT_FOUND') throw new CarrinhoExpirado()
    const mensagens: Record<number, string> = {
      400: 'Verifique a quantidade e os limites do carrinho.',
      404: 'Carrinho ou produto não encontrado.',
      409: 'Carrinho ocupado ou produto indisponível. Atualize os dados ou remova o item.',
      503: 'O carrinho está indisponível. Tente novamente mais tarde.',
    }
    const mensagem = code === 'PRODUCT_NOT_FOUND' || code === 'CART_ITEM_NOT_FOUND' ? 'Produto não encontrado. Seu carrinho foi preservado; remova o item indisponível.' : mensagens[response.status]
    throw new ErroCarrinho(mensagem ?? 'Não foi possível atualizar o carrinho.', response.status, code)
  }
  let carrinho: unknown
  try { carrinho = await response.json() } catch { registrarCarrinho('resposta inválida'); throw new ErroCarrinho('Resposta inválida do carrinho. Consulte os dados antes de tentar novamente.') }
  if (!isCarrinho(carrinho) || (id && carrinho.idCarrinho !== id)) { registrarCarrinho('resposta inválida'); throw new ErroCarrinho('Resposta inválida do carrinho.') }
  return carrinho
}

export const consultarCarrinho = (id: string, signal?: AbortSignal) => requisitarCarrinho('GET', id, undefined, signal)
export const adicionarAoCarrinho = (produtoId: string, id?: string) => requisitarCarrinho('POST', id, { produtoId, quantidade: 1 })
export const atualizarCarrinho = (produtoId: string, quantidade: number, id: string) => requisitarCarrinho('PUT', id, { produtoId, quantidade })

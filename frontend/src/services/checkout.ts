import { API_URL } from './api'
import { isCartId } from './carrinho-storage'
import type { DadosCliente, ItemPedidoConfirmado, PedidoConfirmado } from '../types/checkout'

export class ErroCheckout extends Error {
  readonly incerto: boolean
  readonly status: number

  constructor(message: string, incerto = false, status = 0) {
    super(message)
    this.name = 'ErroCheckout'
    this.incerto = incerto
    this.status = status
  }
}

const centavosValidos = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function isItem(value: unknown): value is ItemPedidoConfirmado {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return isCartId(item.produtoId) && typeof item.nomeProduto === 'string' && typeof item.quantidade === 'number' && Number.isSafeInteger(item.quantidade) && item.quantidade > 0 && centavosValidos(item.precoUnitarioCentavos) && centavosValidos(item.subtotalCentavos)
}

function isPedido(value: unknown): value is PedidoConfirmado {
  if (!value || typeof value !== 'object') return false
  const pedido = value as Record<string, unknown>
  return isCartId(pedido.idPedido) && pedido.status === 'CONFIRMADO' && Array.isArray(pedido.itens) && pedido.itens.length > 0 && pedido.itens.every(isItem) && centavosValidos(pedido.totalCentavos) && ['ACEITO_PELO_SMTP', 'ACEITO_PELA_API', 'FALHOU', 'DESABILITADO'].includes(String(pedido.emailStatus))
}

export async function finalizarCompra(cliente: DadosCliente, id: string): Promise<PedidoConfirmado> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/finalizar-compra`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Cart-Id': id },
      body: JSON.stringify({ nome: cliente.nome, email: cliente.email }),
      signal: AbortSignal.timeout(45000),
    })
  } catch {
    throw new ErroCheckout('Não foi possível confirmar o resultado. O pedido pode ter sido registrado.', true)
  }
  if (!response.ok) {
    const mensagens: Record<number, string> = {
      400: 'Confira seus dados e se o carrinho contém produtos antes de confirmar.',
      404: 'O carrinho ou um produto não está disponível. Confira se o carrinho expirou ou já foi finalizado.',
      409: 'O carrinho está ocupado ou há produtos sem disponibilidade. Atualize sua sacola antes de continuar.',
      422: 'O valor do pedido excede o limite permitido.',
    }
    const segura = Object.hasOwn(mensagens, response.status)
    throw new ErroCheckout(segura ? mensagens[response.status] : 'A confirmação teve um resultado inconclusivo. O pedido pode ter sido registrado.', !segura, response.status)
  }
  let pedido: unknown
  try { pedido = await response.json() } catch { throw new ErroCheckout('A resposta da confirmação não pôde ser verificada.', true) }
  if (!isPedido(pedido)) throw new ErroCheckout('A resposta da confirmação não pôde ser verificada.', true)
  return pedido
}

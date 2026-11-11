import { API_URL } from './api'
import { obterTentativaCheckout, type TentativaCheckout } from './checkout-tentativa'
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
  return isCartId(pedido.idPedido) && pedido.status === 'CONFIRMADO' && Array.isArray(pedido.itens) && pedido.itens.length > 0 && pedido.itens.every(isItem) && centavosValidos(pedido.totalCentavos) && ['PENDENTE', 'ACEITO_PELO_SMTP', 'ACEITO_PELA_API', 'FALHOU', 'DESABILITADO'].includes(String(pedido.emailStatus))
}


export type ResultadoTentativa = { estado: 'PROCESSANDO' | 'CONFIRMADA' | 'ENCERRADA_SEM_PEDIDO'; pedido: PedidoConfirmado | null }

export async function conferirDisponibilidadeCheckout(): Promise<void> {
  let response: Response
  try { response = await fetch(`${API_URL}/checkout/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' }) }
  catch { throw new ErroCheckout('Não foi possível conferir a disponibilidade do checkout. Sua sacola foi preservada.') }
  const estado: unknown = await response.json().catch(() => null)
  if (!response.ok || !estado || typeof estado !== 'object' || !('aberto' in estado) || estado.aberto !== true) throw new ErroCheckout('Estamos atualizando a loja. Sua sacola foi preservada; tente novamente em alguns instantes.')
}

async function solicitarTentativa(t: TentativaCheckout, sufixo: string, body?: DadosCliente): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await fetch(`${API_URL}/auth/checkout/tentativas/${t.id}${sufixo}`, {
      method: 'POST', credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Cart-Id': t.carrinhoId, 'X-Checkout-Token': t.token, 'X-Checkout-Authenticated': t.autenticada ? 'true' : 'false' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000),
    })
  } catch { throw new ErroCheckout('Não foi possível verificar o resultado. Preserve esta tentativa e use Verificar confirmação.', true) }
  if (!resposta.ok) throw new ErroCheckout(resposta.status === 401 ? 'Entre novamente na mesma conta para verificar esta confirmação.' : 'Não foi possível verificar esta tentativa. Ela foi preservada para evitar pedidos duplicados.', true, resposta.status)
  try { return await resposta.json() } catch { throw new ErroCheckout('A resposta não pôde ser verificada. A tentativa foi preservada.', true) }
}

function validarResultado(valor: unknown): ResultadoTentativa {
  if (!valor || typeof valor !== 'object') throw new ErroCheckout('Resposta inválida da confirmação.', true)
  const resultado = valor as ResultadoTentativa
  if (!['PROCESSANDO', 'CONFIRMADA', 'ENCERRADA_SEM_PEDIDO'].includes(resultado.estado) || (resultado.estado === 'CONFIRMADA' ? !isPedido(resultado.pedido) : resultado.pedido !== null)) throw new ErroCheckout('Resposta inválida da confirmação.', true)
  return resultado
}

export async function verificarTentativa(): Promise<ResultadoTentativa> {
  const t = obterTentativaCheckout()
  if (!t) throw new ErroCheckout('Esta tentativa antiga precisa de conferência pelo atendimento. Não refaça a compra antes de verificar o pedido.', true)
  return validarResultado(await solicitarTentativa(t, '/verificar'))
}

export async function finalizarCompra(cliente: DadosCliente, id: string): Promise<PedidoConfirmado> {
  const t = obterTentativaCheckout()
  if (!t || t.carrinhoId !== id) throw new ErroCheckout('Tentativa de confirmação indisponível.', true)
  await solicitarTentativa(t, '', cliente)
  const resultado = validarResultado(await solicitarTentativa(t, '/confirmar'))
  if (resultado.estado === 'CONFIRMADA' && resultado.pedido) return resultado.pedido
  if (resultado.estado === 'ENCERRADA_SEM_PEDIDO') throw new ErroCheckout('A tentativa foi encerrada sem pedido. Confira o estoque e sua sacola antes de tentar novamente.')
  throw new ErroCheckout('A confirmação ainda está em processamento. Use Verificar confirmação.', true)
}

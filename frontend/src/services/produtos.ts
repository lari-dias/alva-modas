import { API_URL } from './api'
import type { Produto } from '../types/produto'

export function isProduto(value: unknown): value is Produto {
  if (typeof value !== 'object' || value === null) return false
  const produto = value as Record<string, unknown>
  return (
    typeof produto.id === 'string' &&
    typeof produto.nome === 'string' &&
    (produto.descricao === null || typeof produto.descricao === 'string') &&
    typeof produto.preco === 'string' &&
    /^\d{1,8}\.\d{2}$/.test(produto.preco) &&
    typeof produto.imagemUrl === 'string' &&
    typeof produto.categoria === 'string' &&
    typeof produto.estoque === 'number' &&
    Number.isInteger(produto.estoque) &&
    produto.estoque >= 0
  )
}

export async function listarProdutos(signal?: AbortSignal): Promise<Produto[]> {
  const timeout = AbortSignal.timeout(10000)
  const response = await fetch(`${API_URL}/produtos`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Não foi possível carregar os produtos.')
  const produtos: unknown = await response.json()
  if (!Array.isArray(produtos) || !produtos.every(isProduto)) {
    throw new Error('A API retornou uma lista de produtos inválida.')
  }
  return produtos
}

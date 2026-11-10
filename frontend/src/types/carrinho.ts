import type { Produto } from './produto'

export interface ItemCarrinho {
  disponivel?: boolean
  produto: Produto
  quantidade: number
  precoUnitarioCentavos: number
  subtotalCentavos: number
}

export interface Carrinho {
  idCarrinho: string
  itens: ItemCarrinho[]
  totalCentavos: number
}

export type OperacaoCarrinho =
  | { tipo: 'adicionar'; produtoId: string }
  | { tipo: 'ajustar'; produtoId: string; delta: 1 | -1 }
  | { tipo: 'remover'; produtoId: string }
  | { tipo: 'reiniciar' }

export const LIMITES_CARRINHO = { itens: 20, unidades: 100, unidadesPorItem: 100 } as const

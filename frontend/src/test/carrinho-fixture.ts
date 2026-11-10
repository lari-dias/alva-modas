import type { Carrinho } from '../types/carrinho'
import type { Produto } from '../types/produto'

export const produtoTeste: Produto = {
  id: 'a17a0000-0000-4000-8000-000000000001', nome: 'Blusa Serena', descricao: null,
  preco: '99.90', imagemUrl: 'https://example.test/blusa.jpg', categoria: 'Blusas', estoque: 5,
}

export const cartIdTeste = 'a17a0000-0000-4000-8000-000000000099'

export function respostaCarrinho(id: string, quantidade: number, total?: number): Carrinho {
  return {
    idCarrinho: id,
    itens: quantidade ? [{ produto: { ...produtoTeste, preco: '10.45' }, quantidade, precoUnitarioCentavos: 1045, subtotalCentavos: quantidade * 1045 }] : [],
    totalCentavos: total ?? quantidade * 1045,
  }
}

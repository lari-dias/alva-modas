import type { Produto } from '../types/produto'

export function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export function filtrarProdutos(produtos: Produto[], busca: string, categoria: string) {
  const termo = normalizarTexto(busca)
  const categoriaNormalizada = normalizarTexto(categoria)
  return produtos.filter((produto) =>
    (!categoriaNormalizada || normalizarTexto(produto.categoria) === categoriaNormalizada)
    && (!termo || normalizarTexto(`${produto.nome} ${produto.descricao ?? ''}`).includes(termo)),
  )
}

export function destinoCatalogo(busca = '', categoria = '') {
  const parametros = new URLSearchParams()
  if (busca.trim()) parametros.set('busca', busca.trim())
  if (categoria) parametros.set('categoria', categoria)
  const query = parametros.toString()
  return `/${query ? `?${query}` : ''}#produtos`
}

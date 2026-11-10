export interface Produto {
  id: string
  nome: string
  descricao: string | null
  preco: string
  imagemUrl: string
  categoria: string
  estoque: number
}

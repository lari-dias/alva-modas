import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProdutos } from './useProdutos'
import { destinoCatalogo, filtrarProdutos } from '../services/catalogo'

export function useCatalogo() {
  const consulta = useProdutos()
  const [parametros] = useSearchParams()
  const navigate = useNavigate()
  const busca = parametros.get('busca') ?? ''
  const categoria = parametros.get('categoria') ?? ''
  const produtos = consulta.data ?? []
  const categorias = [...new Set(produtos.map((produto) => produto.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return {
    consulta, busca, categoria, categorias,
    produtos: filtrarProdutos(produtos, busca, categoria),
    filtrado: Boolean(busca.trim() || categoria),
    buscar: (termo: string) => navigate(destinoCatalogo(termo, categoria)),
    filtrarCategoria: (valor: string) => navigate(destinoCatalogo(busca, valor)),
    limpar: () => navigate(destinoCatalogo()),
    linkCategoria: (valor: string) => destinoCatalogo(busca, valor),
  }
}

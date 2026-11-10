import { useQuery } from '@tanstack/react-query'
import { listarProdutos } from '../services/produtos'

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: ({ signal }) => listarProdutos(signal),
  })
}

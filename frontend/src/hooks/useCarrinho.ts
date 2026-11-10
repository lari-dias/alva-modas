import { useContext } from 'react'
import { CarrinhoContext } from '../contexts/carrinho-context'

export function useCarrinho() {
  const context = useContext(CarrinhoContext)
  if (!context) throw new Error('CarrinhoProvider não encontrado.')
  return context
}

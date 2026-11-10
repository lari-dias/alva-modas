import type { ReactNode } from 'react'
import { CarrinhoContext } from '../contexts/carrinho-context'
import { useCarrinhoController } from '../hooks/useCarrinhoController'

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const carrinho = useCarrinhoController()
  return <CarrinhoContext.Provider value={carrinho}>{children}</CarrinhoContext.Provider>
}

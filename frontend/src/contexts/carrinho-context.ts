import { createContext } from 'react'
import type { useCarrinhoController } from '../hooks/useCarrinhoController'

export type CarrinhoContextValue = ReturnType<typeof useCarrinhoController>
export const CarrinhoContext = createContext<CarrinhoContextValue | null>(null)

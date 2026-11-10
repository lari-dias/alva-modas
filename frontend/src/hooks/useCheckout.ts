import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCarrinho } from './useCarrinho'
import { serializarCarrinho } from '../services/carrinho-lock'
import { lerCarrinhoId } from '../services/carrinho-storage'
import { assinarTentativaCheckout, iniciarTentativaCheckout, lerTentativaCheckout, limparTentativaCheckout } from '../services/checkout-tentativa'
import { ErroCheckout, finalizarCompra } from '../services/checkout'
import type { DadosCliente } from '../types/checkout'

const semTentativaServidor = () => null

export function useCheckout() {
  const cart = useCarrinho()
  const client = useQueryClient()
  const tentativa = useSyncExternalStore(assinarTentativaCheckout, lerTentativaCheckout, semTentativaServidor)
  const enviando = useRef(false)
  useEffect(() => {
    if (cart.id && !lerTentativaCheckout()) void client.invalidateQueries({ queryKey: ['carrinho', cart.id], exact: true })
  }, [cart.id, client])
  const mutation = useMutation({
    mutationKey: ['carrinho-operacao', 'checkout'],
    scope: { id: 'alva-modas:carrinho' },
    retry: false,
    networkMode: 'always',
    onMutate: async () => { await client.cancelQueries({ queryKey: ['carrinho'] }) },
    mutationFn: (dados: DadosCliente) => serializarCarrinho(async () => {
      const id = lerCarrinhoId()
      if (!id || id !== cart.id || !cart.carrinho?.itens.length) throw new ErroCheckout('Seu carrinho está vazio ou não está mais disponível.')
      if (lerTentativaCheckout()) throw new ErroCheckout('Há uma confirmação aguardando verificação. Não envie outro pedido.', true)
      try { iniciarTentativaCheckout(id) } catch { throw new ErroCheckout('Não foi possível proteger esta confirmação. Verifique o armazenamento do navegador e se há outra tentativa em andamento.') }
      try {
        const pedido = await finalizarCompra(dados, id)
        cart.concluirCompra(id)
        limparTentativaCheckout(id)
        return pedido
      } catch (error) {
        if (error instanceof ErroCheckout && !error.incerto) limparTentativaCheckout(id)
        throw error
      }
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['produtos'] }) },
    onError: (error) => {
      if (error instanceof ErroCheckout && !error.incerto) cart.recarregar()
    },
  })

  return {
    pedido: mutation.data,
    enviando: mutation.isPending,
    incerto: Boolean(tentativa) && !mutation.isPending,
    erro: mutation.error instanceof ErroCheckout ? mutation.error.message : mutation.error ? 'Não foi possível verificar a confirmação. Confira o resultado antes de continuar.' : null,
    confirmar: async (dados: DadosCliente) => {
      if (enviando.current || tentativa || mutation.isPending) return
      enviando.current = true
      try { await mutation.mutateAsync(dados) } catch { return } finally { enviando.current = false }
    },
  }
}

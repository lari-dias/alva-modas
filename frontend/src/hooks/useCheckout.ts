import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCarrinho } from './useCarrinho'
import { useAuth } from './useAuth'
import { serializarCarrinho } from '../services/carrinho-lock'
import { lerCarrinhoId } from '../services/carrinho-storage'
import { assinarTentativaCheckout, iniciarTentativaCheckout, lerTentativaCheckout, limparTentativaCheckout, obterTentativaCheckout } from '../services/checkout-tentativa'
import { ErroCheckout, finalizarCompra, verificarTentativa, conferirDisponibilidadeCheckout } from '../services/checkout'
import type { DadosCliente, PedidoConfirmado } from '../types/checkout'

const semTentativaServidor = () => null

export function useCheckout() {
  const cart = useCarrinho()
  const auth = useAuth()
  const client = useQueryClient()
  const tentativa = useSyncExternalStore(assinarTentativaCheckout, lerTentativaCheckout, semTentativaServidor)
  const enviando = useRef(false)
  const [pedidoRecuperado, setPedidoRecuperado] = useState<PedidoConfirmado | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState<string | null>(null)
  const verificacaoEmCurso = useRef(false)
  useEffect(() => {
    if (cart.id && !lerTentativaCheckout()) void client.invalidateQueries({ queryKey: ['carrinho', cart.id], exact: true })
  }, [cart.id, client])
  const mutation = useMutation({
    mutationKey: ['carrinho-operacao', 'checkout'],
    scope: { id: 'alva-modas:carrinho' },
    retry: false,
    networkMode: 'always',
    onMutate: async () => { setMensagemRecuperacao(null); await client.cancelQueries({ queryKey: ['carrinho'] }) },
    mutationFn: (dados: DadosCliente) => serializarCarrinho(async () => {
      const id = lerCarrinhoId()
      if (!id || id !== cart.id || !cart.carrinho?.itens.length) throw new ErroCheckout('Seu carrinho está vazio ou não está mais disponível.')
      if (lerTentativaCheckout()) throw new ErroCheckout('Há uma confirmação aguardando verificação. Não envie outro pedido.', true)
      await conferirDisponibilidadeCheckout()
      try { iniciarTentativaCheckout(id, Boolean(auth.cliente)) } catch { throw new ErroCheckout('Não foi possível proteger esta confirmação. Verifique o armazenamento do navegador e se há outra tentativa em andamento.') }
      const registro = lerTentativaCheckout()
      try {
        const pedido = await finalizarCompra(dados, id)
        cart.concluirCompra(id)
        limparTentativaCheckout(id, registro)
        return pedido
      } catch (error) {
        if (error instanceof ErroCheckout && !error.incerto) limparTentativaCheckout(id, registro)
        throw error
      }
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['produtos'] }) },
    onError: (error) => {
      if (error instanceof ErroCheckout && !error.incerto) cart.recarregar()
    },
  })

  return {
    pedido: pedidoRecuperado ?? mutation.data,
    verificando,
    mensagemRecuperacao,
    verificar: async () => {
      if (verificacaoEmCurso.current || mutation.isPending) return
      verificacaoEmCurso.current = true
      setVerificando(true)
      setMensagemRecuperacao(null)
      try {
        await serializarCarrinho(async () => {
          const atual = lerTentativaCheckout()
          const registro = obterTentativaCheckout()
          const resultado = await verificarTentativa()
          if (atual !== lerTentativaCheckout() || !registro) return
          if (resultado.estado === 'CONFIRMADA' && resultado.pedido) {
            mutation.reset()
            setPedidoRecuperado(resultado.pedido)
            cart.concluirCompra(registro.carrinhoId)
            limparTentativaCheckout(registro.carrinhoId, atual)
            await client.invalidateQueries({ queryKey: ['produtos'] })
          } else if (resultado.estado === 'ENCERRADA_SEM_PEDIDO') {
            mutation.reset()
            limparTentativaCheckout(registro.carrinhoId, atual)
            cart.recarregar()
            setMensagemRecuperacao('A tentativa foi encerrada sem pedido. Confira sua sacola antes de continuar.')
          } else {
            setMensagemRecuperacao('A confirmação ainda está em processamento. Aguarde e verifique novamente.')
          }
        })
      } catch (error) {
        setMensagemRecuperacao(error instanceof Error ? error.message : 'Não foi possível verificar. A tentativa foi preservada.')
      } finally {
        verificacaoEmCurso.current = false
        setVerificando(false)
      }
    },
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

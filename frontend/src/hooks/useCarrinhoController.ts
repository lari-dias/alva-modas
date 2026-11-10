import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adicionarAoCarrinho, atualizarCarrinho, CarrinhoExpirado, consultarCarrinho, ErroCarrinho } from '../services/carrinho'
import { assinarCarrinhoId, lerCarrinhoId, salvarCarrinhoId } from '../services/carrinho-storage'
import { serializarCarrinho } from '../services/carrinho-lock'
import { LIMITES_CARRINHO } from '../types/carrinho'
import type { Carrinho, OperacaoCarrinho } from '../types/carrinho'
import { assinarTentativaCheckout, lerTentativaCheckout } from '../services/checkout-tentativa'

const chave = (id: string | null) => ['carrinho', id] as const
const semIdNoServidor = () => null

export function useCarrinhoController() {
  const client = useQueryClient()
  const id = useSyncExternalStore(assinarCarrinhoId, lerCarrinhoId, semIdNoServidor)
  const checkoutPendente = useSyncExternalStore(assinarTentativaCheckout, lerTentativaCheckout, semIdNoServidor)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const focoRetorno = useRef<HTMLElement | null>(null)
  const mutacoes = useIsMutating({ mutationKey: ['carrinho-operacao'] })

  const esquecerExpirado = useCallback((cartId: string) => {
    if (lerCarrinhoId() !== cartId) return
    salvarCarrinhoId(null)
    client.removeQueries({ queryKey: chave(cartId), exact: true })
    setFeedback(null)
    setErro(new CarrinhoExpirado().message)
  }, [client])

  const consulta = useQuery({
    queryKey: chave(id),
    enabled: Boolean(id) && mutacoes === 0 && !checkoutPendente,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => serializarCarrinho(async () => {
      signal.throwIfAborted()
      if (!id || lerCarrinhoId() !== id) throw new DOMException('Consulta cancelada.', 'AbortError')
      try {
        return await consultarCarrinho(id, signal)
      } catch (error) {
        if (error instanceof CarrinhoExpirado) esquecerExpirado(id)
        throw error
      }
    }),
  })

  const mutation = useMutation({
    mutationKey: ['carrinho-operacao'],
    scope: { id: 'alva-modas:carrinho' },
    retry: false,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ['carrinho'] })
      setErro(null)
      setFeedback(null)
    },
    mutationFn: (operacao: OperacaoCarrinho) => serializarCarrinho(async (): Promise<Carrinho | null> => {
      const cartId = lerCarrinhoId()
      if (lerTentativaCheckout()) throw new ErroCarrinho('Há uma confirmação em andamento ou aguardando verificação. Não altere a sacola até conferir o resultado.')
      if (operacao.tipo === 'reiniciar') {
        salvarCarrinhoId(null)
        client.removeQueries({ queryKey: ['carrinho'] })
        return null
      }
      try {
        let resposta: Carrinho
        if (operacao.tipo === 'adicionar') {
          resposta = await adicionarAoCarrinho(operacao.produtoId, cartId ?? undefined)
        } else {
          if (!cartId) throw new CarrinhoExpirado()
          let quantidade = 0
          if (operacao.tipo === 'ajustar') {
            const atual = operacao.delta < 0
              ? client.getQueryData<Carrinho>(chave(cartId))
              : await consultarCarrinho(cartId)
            if (!atual) throw new ErroCarrinho('Consulte o carrinho antes de alterar a quantidade.')
            client.setQueryData(chave(cartId), atual)
            const item = atual.itens.find((item) => item.produto.id === operacao.produtoId)
            if (!item) throw new ErroCarrinho('O produto não está mais no carrinho.', 404)
            quantidade = item.quantidade + operacao.delta
            const unidades = atual.itens.reduce((total, item) => total + item.quantidade, 0) + operacao.delta
            if (quantidade < 0 || (operacao.delta > 0 && (quantidade > item.produto.estoque || quantidade > LIMITES_CARRINHO.unidadesPorItem || unidades > LIMITES_CARRINHO.unidades))) {
              throw new ErroCarrinho('A quantidade excede o estoque ou o limite do carrinho.', 400)
            }
          }
          resposta = await atualizarCarrinho(operacao.produtoId, quantidade, cartId)
        }
        client.setQueryData(chave(resposta.idCarrinho), resposta)
        salvarCarrinhoId(resposta.idCarrinho)
        return resposta
      } catch (error) {
        if (cartId && error instanceof CarrinhoExpirado) esquecerExpirado(cartId)
        throw error
      }
    }),
    onSuccess: (_carrinho, operacao) => {
      setErro(null)
      setFeedback(operacao.tipo === 'adicionar' ? 'Produto adicionado ao carrinho.' : operacao.tipo === 'remover' ? 'Produto removido do carrinho.' : operacao.tipo === 'reiniciar' ? 'Adicione produtos para começar um novo carrinho.' : 'Quantidade atualizada.')
    },
    onError: (error) => {
      setErro(error instanceof ErroCarrinho ? error.message : 'Não foi possível atualizar o carrinho. Consulte os dados antes de tentar novamente.')
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ['carrinho'], refetchType: 'none' })
      await client.invalidateQueries({ queryKey: ['produtos'], refetchType: 'none' })
    },
  })

  const abrir = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) focoRetorno.current = document.activeElement
    setAberto(true)
    const atual = lerCarrinhoId()
    if (atual) void client.invalidateQueries({ queryKey: chave(atual) })
  }, [client])
  const fechar = useCallback(() => setAberto(false), [])
  const carrinho = id ? consulta.data : undefined
  const ocupado = mutacoes > 0 || consulta.isFetching || Boolean(checkoutPendente)
  const quantidade = carrinho?.itens.reduce((total, item) => total + item.quantidade, 0) ?? 0

  return {
    aberto, abrir, fechar, focoRetorno, carrinho, id, ocupado, quantidade,
    concluirCompra: (cartId: string) => {
      if (lerCarrinhoId() === cartId) salvarCarrinhoId(null)
      client.removeQueries({ queryKey: chave(cartId), exact: true })
      setErro(null)
      setFeedback(null)
      setAberto(false)
    },
    carregando: Boolean(id) && consulta.isPending && !consulta.isError,
    erro: checkoutPendente && mutacoes === 0 ? 'Há uma confirmação com resultado pendente. Confira o pedido antes de alterar a sacola.' : erro ?? (carrinho?.itens.some((item) => item.disponivel === false) ? 'Há itens indisponíveis. Reduza a quantidade ou remova-os antes de continuar.' : null) ?? (consulta.isError ? 'Não foi possível consultar o carrinho. Atualize os dados antes de continuar.' : null),
    feedback,
    dadosDesatualizados: consulta.isError || Boolean(carrinho?.itens.some((item) => item.disponivel === false)) || Boolean(checkoutPendente && mutacoes === 0),
    produtoPendente: mutation.isPending && mutation.variables.tipo === 'adicionar' ? mutation.variables.produtoId : null,
    adicionar: (produtoId: string) => { abrir(); mutation.mutate({ tipo: 'adicionar', produtoId }) },
    ajustar: (produtoId: string, delta: 1 | -1) => mutation.mutate({ tipo: 'ajustar', produtoId, delta }),
    remover: (produtoId: string) => mutation.mutate({ tipo: 'remover', produtoId }),
    reiniciar: () => mutation.mutate({ tipo: 'reiniciar' }),
    recarregar: () => { setErro(null); setFeedback(null); if (id) void consulta.refetch() },
    podeAdicionar: (produtoId: string, estoque: number) => {
      const item = carrinho?.itens.find((item) => item.produto.id === produtoId)
      const disponivel = item ? Math.min(estoque, item.produto.estoque) : estoque
      return !ocupado && disponivel > (item?.quantidade ?? 0) && quantidade < LIMITES_CARRINHO.unidades && (Boolean(item) || (carrinho?.itens.length ?? 0) < LIMITES_CARRINHO.itens) && (item?.quantidade ?? 0) < LIMITES_CARRINHO.unidadesPorItem
    },
  }
}

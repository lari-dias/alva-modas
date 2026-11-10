import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cadastrar, consultarCliente, entrar, sair } from '../services/auth'
import type { Cadastro, Credenciais } from '../types/auth'
import { useRef } from 'react'

const chave = ['cliente-autenticado']

export function useAuthController() {
  const cache = useQueryClient()
  const emCurso = useRef(false)
  const consulta = useQuery({ queryKey: chave, queryFn: consultarCliente, retry: false, staleTime: 60000 })
  const mutation = useMutation({
    mutationFn: async (acao: { tipo: 'login', dados: Credenciais } | { tipo: 'cadastro', dados: Cadastro } | { tipo: 'logout' }) => {
      await cache.cancelQueries({ queryKey: chave })
      return acao.tipo === 'logout' ? (await sair(), null) : acao.tipo === 'login' ? entrar(acao.dados) : cadastrar(acao.dados)
    },
    retry: false,
    onSuccess: (cliente) => cache.setQueryData(chave, cliente),
  })
  async function executar(acao: Parameters<typeof mutation.mutateAsync>[0]) {
    if (emCurso.current) return
    emCurso.current = true
    try { await mutation.mutateAsync(acao) } finally { emCurso.current = false }
  }
  return {
    cliente: consulta.data ?? null,
    carregando: consulta.isPending,
    ocupado: mutation.isPending,
    erro: mutation.error?.message ?? consulta.error?.message,
    limparErro: mutation.reset,
    recarregar: () => { void consulta.refetch() },
    entrar: (dados: Credenciais) => executar({ tipo: 'login', dados }),
    cadastrar: (dados: Cadastro) => executar({ tipo: 'cadastro', dados }),
    sair: () => executar({ tipo: 'logout' }),
  }
}

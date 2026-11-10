import { API_URL } from './api'
import type { Cadastro, Cliente, Credenciais } from '../types/auth'

async function solicitar<T>(caminho: string, dados?: unknown): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`${API_URL}/auth/${caminho}`, {
      method: dados === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: dados === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: dados === undefined ? undefined : JSON.stringify(dados),
    })
  } catch {
    throw new Error('Não foi possível conectar. Verifique sua conexão e tente novamente.')
  }
  if (caminho === 'me' && resposta.status === 401) return null as T
  if (!resposta.ok) {
    if (resposta.status === 409) throw new Error('Este e-mail já está cadastrado. Entre na sua conta.')
    if (resposta.status === 401) throw new Error('E-mail ou senha inválidos.')
    if (resposta.status === 400) throw new Error('Confira os dados informados.')
    if (resposta.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
    throw new Error('Não foi possível concluir. Tente novamente mais tarde.')
  }
  if (resposta.status === 204) return undefined as T
  return resposta.json() as Promise<T>
}

export const consultarCliente = () => solicitar<Cliente | null>('me')
export const entrar = (dados: Credenciais) => solicitar<Cliente>('login', dados)
export const cadastrar = (dados: Cadastro) => solicitar<Cliente>('cadastro', dados)
export const sair = () => solicitar<void>('logout', {})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { produtoTeste, cartIdTeste, respostaCarrinho } from './carrinho-fixture'
import { CART_STORAGE_KEY } from '../services/carrinho-storage'

describe('Autenticação de clientes', () => {
  const cliente = { id: 'a17a0000-0000-4000-8000-000000000001', nome: 'Maria Silva', email: 'maria@example.com' }
  let client: QueryClient
  let autenticado: boolean
  let falha: number | null
  let pendente: boolean
  let liberar: ((response: Response) => void) | undefined
  let chamadas: Array<{ path: string, options: RequestInit }>
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    autenticado = false
    falha = null
    pendente = false
    liberar = undefined
    chamadas = []
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, options: RequestInit = {}) => {
      const path = new URL(String(input)).pathname
      if (path === '/produtos') return Response.json([produtoTeste])
      if (path === '/carrinho') return Response.json(respostaCarrinho(cartIdTeste, 2))
      if (path === '/auth/me') return Response.json(autenticado ? cliente : {}, { status: autenticado ? 200 : 401 })
      chamadas.push({ path, options })
      if (falha === 0) throw new TypeError('network error')
      if (falha) return Response.json({}, { status: falha })
      if (path === '/auth/logout') { autenticado = false; return new Response(null, { status: 204 }) }
      if (pendente) return new Promise<Response>((resolve) => { liberar = resolve })
      autenticado = true
      return Response.json(cliente)
    }))
  })
  afterEach(() => { client.clear() })

  function montar(path = '/conta') {
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><CarrinhoProvider><App /></CarrinhoProvider></MemoryRouter></QueryClientProvider>)
  }
  async function preencher(cadastro = false) {
    const user = userEvent.setup()
    await screen.findByLabelText('E-mail')
    if (cadastro) await user.type(screen.getByLabelText('Nome completo'), 'Maria Silva')
    await user.type(screen.getByLabelText('E-mail'), '  MARIA@example.com  ')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'Senha-segura-123')
    if (cadastro) await user.type(screen.getByLabelText('Confirmar senha'), 'Senha-segura-123')
    return user
  }

  it('valida nome, e-mail e senha sem chamar a API', async () => {
    montar('/cadastro')
    await userEvent.click(await screen.findByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Informe seu nome.')).toBeVisible()
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()
    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeVisible()
    expect(chamadas).toHaveLength(0)
  })

  it('valida confirmação de senha', async () => {
    montar('/cadastro')
    const user = await preencher(true)
    await user.clear(screen.getByLabelText('Confirmar senha'))
    await user.type(screen.getByLabelText('Confirmar senha'), 'Outra-senha-123')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('As senhas não coincidem.')).toBeVisible()
    expect(chamadas).toHaveLength(0)
  })

  it('cadastra com dados normalizados, credenciais HttpOnly e sem persistir token ou senha', async () => {
    montar('/cadastro')
    const user = await preencher(true)
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Olá, Maria Silva.')).toBeVisible()
    expect(chamadas[0].path).toBe('/auth/cadastro')
    expect(chamadas[0].options.credentials).toBe('include')
    expect(JSON.parse(String(chamadas[0].options.body))).toEqual({ nome: cliente.nome, email: cliente.email, senha: 'Senha-segura-123', confirmacaoSenha: 'Senha-segura-123' })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(screen.getByRole('link', { name: 'Minha conta, Maria Silva' })).toHaveAttribute('href', '/conta')
  })

  it('faz login e logout sem perder a sacola', async () => {
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar()
    const user = await preencher()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Olá, Maria Silva.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('heading', { name: 'Bem-vinda à Alva' })).toBeVisible()
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 2 unidades' })).toBeEnabled()
    expect(chamadas.map(({ path }) => path)).toEqual(['/auth/login', '/auth/logout'])
  })

  it('restaura uma sessão existente sem depender do localStorage', async () => {
    autenticado = true
    montar()
    expect(await screen.findByText('Olá, Maria Silva.')).toBeVisible()
    expect(localStorage.length).toBe(0)
  })

  it.each([[401, 'E-mail ou senha inválidos.'], [409, 'Este e-mail já está cadastrado. Entre na sua conta.'], [429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'], [500, 'Não foi possível concluir. Tente novamente mais tarde.'], [0, 'Não foi possível conectar. Verifique sua conexão e tente novamente.']])('trata falha %i sem repetir o envio', async (status, mensagem) => {
    falha = Number(status)
    montar()
    const user = await preencher()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(mensagem)).toBeVisible()
    expect(chamadas).toHaveLength(1)
    expect(screen.queryByText('Olá, Maria Silva.')).toBeNull()
  })

  it('bloqueia envios duplicados e mostra carregamento', async () => {
    pendente = true
    montar()
    const user = await preencher()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('button', { name: 'Aguarde...' })).toBeDisabled()
    const form = screen.getByRole('form', { name: 'Login de cliente' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(chamadas).toHaveLength(1))
    await act(async () => { liberar?.(Response.json(cliente)) })
    expect(await screen.findByText('Olá, Maria Silva.')).toBeVisible()
  })

  it('mantém estado autenticado se logout falhar', async () => {
    autenticado = true
    montar()
    await screen.findByText('Olá, Maria Silva.')
    falha = 500
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir.')
    expect(screen.getByText('Olá, Maria Silva.')).toBeVisible()
  })

  it('abre a conta pelo Header e navega entre login e cadastro', async () => {
    montar('/')
    await userEvent.click(screen.getByRole('link', { name: 'Minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Bem-vinda à Alva' })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Criar conta' }))
    expect(await screen.findByLabelText('Confirmar senha')).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Entrar' }))
    expect(screen.queryByLabelText('Confirmar senha')).toBeNull()
    expect(screen.getByText('Você também pode comprar como visitante, sem criar uma conta.')).toBeVisible()
  })

  it('continua permitindo checkout como visitante', async () => {
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar('/checkout')
    expect(await screen.findByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
    expect(screen.queryByLabelText('Senha')).toBeNull()
    expect(chamadas).toHaveLength(0)
  })
});

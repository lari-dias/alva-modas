import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { AuthProvider } from '../providers/AuthProvider'
import { useCarrinho } from '../hooks/useCarrinho'
import { Header } from '../components/Header'
import { ProductCard } from '../components/ProductCard'
import { CartDrawer } from '../components/CartDrawer'
import { CART_STORAGE_KEY } from '../services/carrinho-storage'
import { produtoTeste, cartIdTeste, respostaCarrinho } from './carrinho-fixture'

describe('Integração do carrinho', () => {
  let client: QueryClient
  let carrinhos: Map<string, number>
  let contador: number
  let falha: number | null
  let totalServidor: number | undefined
  let invalidaResposta: boolean
  let produtoInexistente: boolean
  let falhaConsulta: number | null
  let estoqueAtual: number
  let ativas: number
  let maximoAtivas: number
  let chamadas: Array<{ method: string; id: string | null; body?: { produtoId: string; quantidade: number } }>

  beforeEach(() => {
    localStorage.clear()
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    carrinhos = new Map()
    contador = 0
    falha = null
    totalServidor = undefined
    invalidaResposta = false
    produtoInexistente = false
    falhaConsulta = null
    estoqueAtual = produtoTeste.estoque
    ativas = 0
    maximoAtivas = 0
    chamadas = []
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options: RequestInit = {}) => {
      if (String(_url).endsWith('/auth/me')) return Response.json({}, { status: 401 })
      if (String(_url).endsWith('/produtos')) return Response.json([produtoTeste])
      ativas++
      maximoAtivas = Math.max(maximoAtivas, ativas)
      try {
        await new Promise((resolve) => setTimeout(resolve, 5))
        options.signal?.throwIfAborted()
        const method = options.method ?? 'GET'
        const id = new Headers(options.headers).get('X-Cart-Id')
        const body = options.body ? JSON.parse(String(options.body)) as { produtoId: string; quantidade: number } : undefined
        chamadas.push({ method, id, body })
        if (falha) return Response.json({ message: 'Test API error' }, { status: falha })
        if (invalidaResposta) return Response.json({ idCarrinho: 'invalid' })
        if (id && !carrinhos.has(id)) return Response.json({ code: 'CART_NOT_FOUND' }, { status: 404 })
        if (method === 'GET' && falhaConsulta) return Response.json({ code: falhaConsulta === 404 ? 'PRODUCT_NOT_FOUND' : 'PRODUCT_UNAVAILABLE' }, { status: falhaConsulta })
        if (method === 'POST') {
          if (produtoInexistente) return Response.json({ code: 'PRODUCT_NOT_FOUND' }, { status: 404 })
          const atual = id ?? `a17a0000-0000-4000-8000-${String(++contador).padStart(12, '0')}`
          const quantidade = (carrinhos.get(atual) ?? 0) + (body?.quantidade ?? 0)
          if (quantidade > produtoTeste.estoque) return Response.json({}, { status: 409 })
          carrinhos.set(atual, quantidade)
          return Response.json(respostaCarrinho(atual, quantidade, totalServidor), { status: 201 })
        }
        if (!id) return Response.json({}, { status: 400 })
        if (method === 'PUT') {
          const quantidade = body?.quantidade ?? 0
          if ((quantidade > estoqueAtual && quantidade >= (carrinhos.get(id) ?? 0)) || quantidade < 0) return Response.json({}, { status: 409 })
          carrinhos.set(id, quantidade)
        }
        const resposta = respostaCarrinho(id, carrinhos.get(id) ?? 0, totalServidor)
        resposta.itens.forEach(item => { item.produto.estoque = estoqueAtual; item.disponivel = item.quantidade <= estoqueAtual })
        return Response.json(resposta)
      } finally {
        ativas--
      }
    }))
  })

  afterEach(async () => {
    await waitFor(() => expect(ativas).toBe(0))
    client.clear()
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter><AuthProvider><CarrinhoProvider>{children}</CarrinhoProvider></AuthProvider></MemoryRouter></QueryClientProvider>
  }

  function montar() {
    return render(<Wrapper><Header /><ProductCard produto={produtoTeste} /><CartDrawer /></Wrapper>)
  }

  async function adicionarPelaTela() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Adicionar ${produtoTeste.nome} ao carrinho` }))
    const dialog = screen.getByRole('dialog', { name: /Sua sacola/ })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Aumentar quantidade/ })).toBeEnabled())
    return { user, dialog }
  }

  it('adiciona, persiste apenas o UUID e exibe preços e total calculados pelo servidor', async () => {
    totalServidor = 4321
    montar()
    const { dialog } = await adicionarPelaTela()
    expect(await within(dialog).findByText('Produto adicionado ao carrinho.')).toBeVisible()
    expect(within(dialog).getByText(/R\$\s*43,21/)).toBeVisible()
    expect(within(dialog).getByText(/R\$\s*10,45/, { selector: '.cart-unit-price' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 1 unidades' })).toBeVisible()
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(CART_STORAGE_KEY)).toMatch(/^[0-9a-f-]{36}$/)
    const post = chamadas.find((call) => call.method === 'POST')!
    expect(post.id).toBeNull()
    expect(post.body).toEqual({ produtoId: produtoTeste.id, quantidade: 1 })
    expect(within(dialog).getByRole('link', { name: 'Finalizar compra' })).toHaveAttribute('href', '/checkout')
  })

  it('atualiza quantidade, diminui e remove via PUT mantendo a sacola sincronizada', async () => {
    montar()
    const { dialog, user } = await adicionarPelaTela()
    await user.click(within(dialog).getByRole('button', { name: /Aumentar quantidade/ }))
    await waitFor(() => expect(within(dialog).getByLabelText(`2 unidades de ${produtoTeste.nome}`)).toBeVisible())
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Diminuir quantidade/ })).toBeEnabled())
    expect(within(dialog).getAllByText(/R\$\s*20,90/)).toHaveLength(2)
    await user.click(within(dialog).getByRole('button', { name: /Diminuir quantidade/ }))
    await waitFor(() => expect(within(dialog).getByLabelText(`1 unidades de ${produtoTeste.nome}`)).toBeVisible())
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Remover Blusa/ })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: /Remover Blusa/ }))
    expect(await within(dialog).findByText('Sua sacola está vazia')).toBeVisible()
    expect(within(dialog).getByText(/R\$\s*0,00/)).toBeVisible()
    expect(chamadas.filter((call) => call.method === 'PUT').map((call) => call.body?.quantidade)).toEqual([2, 1, 0])
    expect(chamadas.filter((call) => call.method !== 'POST').every((call) => Boolean(call.id))).toBe(true)
  })

  it('carrega um UUID persistido e bloqueia aumento acima do estoque', async () => {
    carrinhos.set(cartIdTeste, 5)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/ }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByLabelText(`5 unidades de ${produtoTeste.nome}`)).toBeVisible())
    expect(within(dialog).getByRole('button', { name: /Aumentar quantidade/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Adicionar Blusa/ })).toBeDisabled()
    expect(chamadas.every((call) => call.method === 'GET')).toBe(true)
  })

  it.each([409, 500])('exibe erro HTTP %s sem feedback falso e permite tentar novamente', async (status) => {
    falha = status
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Adicionar Blusa/ }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toBeVisible()
    expect(within(dialog).queryByText('Produto adicionado ao carrinho.')).toBeNull()
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(chamadas.filter((call) => call.method === 'POST')).toHaveLength(1)
    falha = null
    await user.click(within(dialog).getByRole('button', { name: 'Fechar carrinho' }))
    await user.click(screen.getByRole('button', { name: /Adicionar Blusa/ }))
    expect(await screen.findByText('Produto adicionado ao carrinho.')).toBeVisible()
  })

  it('descarta carrinho expirado sem recuperar produtos ou criar outro automaticamente', async () => {
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('expirou ou não existe mais')
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(chamadas.every((call) => call.method === 'GET')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Começar novo carrinho' }))
    expect(await screen.findByText('Sua sacola está vazia')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Fechar carrinho' }))
    await user.click(screen.getByRole('button', { name: /Adicionar Blusa/ }))
    expect(await screen.findByText('Produto adicionado ao carrinho.')).toBeVisible()
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBe(cartIdTeste)
    expect(chamadas.filter((call) => call.method === 'POST')).toHaveLength(1)
  })

  it('serializa duas primeiras adições rápidas e usa o primeiro UUID na segunda', async () => {
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    act(() => { result.current.adicionar(produtoTeste.id); result.current.adicionar(produtoTeste.id) })
    await waitFor(() => expect(result.current.carrinho?.itens[0].quantidade).toBe(2))
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    const posts = chamadas.filter((call) => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].id).toBeNull()
    expect(posts[1].id).toBe(localStorage.getItem(CART_STORAGE_KEY))
    expect(carrinhos.size).toBe(1)
    expect(maximoAtivas).toBe(1)
  })

  it('serializa aumentos rápidos a partir da última quantidade do servidor', async () => {
    carrinhos.set(cartIdTeste, 1)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.carrinho).toBeDefined())
    act(() => { result.current.ajustar(produtoTeste.id, 1); result.current.ajustar(produtoTeste.id, 1) })
    await waitFor(() => expect(result.current.carrinho?.itens[0].quantidade).toBe(3))
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    expect(chamadas.filter((call) => call.method === 'PUT').map((call) => call.body?.quantidade)).toEqual([2, 3])
    expect(maximoAtivas).toBe(1)
  })

  it('rejeita respostas inválidas sem salvar dados inventados', async () => {
    invalidaResposta = true
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Adicionar Blusa/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Resposta inválida')
    expect(localStorage.length).toBe(0)
    expect(screen.queryByText('Produto adicionado ao carrinho.')).toBeNull()
  })

  it('não descarta um carrinho válido quando apenas o produto retorna 404', async () => {
    carrinhos.set(cartIdTeste, 1)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.carrinho).toBeDefined())
    produtoInexistente = true
    act(() => result.current.adicionar(produtoTeste.id))
    await waitFor(() => expect(result.current.erro).toBeTruthy())
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
    expect(result.current.quantidade).toBe(1)
    expect(chamadas.filter((call) => call.method === 'POST')).toHaveLength(1)
  })

  it('não recria automaticamente um carrinho que desaparece durante a adição', async () => {
    carrinhos.set(cartIdTeste, 1)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.carrinho).toBeDefined())
    carrinhos.delete(cartIdTeste)
    act(() => result.current.adicionar(produtoTeste.id))
    await waitFor(() => expect(result.current.erro).toContain('expirou'))
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(chamadas.filter((call) => call.method === 'POST')).toHaveLength(1)
    expect(carrinhos.size).toBe(0)
  })

  it('não repete POST automaticamente após falha de rede', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    montar()
    await userEvent.click(screen.getByRole('button', { name: /Adicionar Blusa/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar')
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/carrinho'))).toHaveLength(1)
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(screen.queryByText('Produto adicionado ao carrinho.')).toBeNull()
  })

  it('usa Web Locks quando disponíveis para compartilhar a exclusão entre abas', async () => {
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback())
    const navigatorOriginal = navigator
    vi.stubGlobal('navigator', Object.assign(Object.create(navigatorOriginal) as Navigator, { locks: { request } }))
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    act(() => result.current.adicionar(produtoTeste.id))
    await waitFor(() => expect(result.current.quantidade).toBe(1))
    expect(request).toHaveBeenCalledWith('alva-modas:carrinho', expect.any(Function))
  })

  it('ao reiniciar remove apenas o identificador do carrinho e preserva outros dados do navegador', async () => {
    localStorage.setItem('outra-chave', 'preservar')
    carrinhos.set(cartIdTeste, 1)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.carrinho).toBeDefined())
    act(() => result.current.reiniciar())
    await waitFor(() => expect(result.current.id).toBeNull())
    expect(localStorage.getItem('outra-chave')).toBe('preservar')
    expect(result.current.quantidade).toBe(0)
    expect(chamadas.every((call) => call.method === 'GET')).toBe(true)
  })

  it('mantém foco no drawer, fecha com Escape e devolve foco à sacola', async () => {
    montar()
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: 'Abrir carrinho' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Fechar carrinho' })
    expect(close).toHaveFocus()
    const continuar = within(dialog).getByRole('button', { name: 'Continuar comprando' })
    await user.tab({ shift: true })
    expect(continuar).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('permite diminuir e remover itens indisponíveis com leitura atualizada antes do PUT', async () => {
    carrinhos.set(cartIdTeste, 2)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/ }))
    await waitFor(() => expect(screen.getByLabelText(`2 unidades de ${produtoTeste.nome}`)).toBeVisible())
    estoqueAtual = 1
    await act(async () => { await client.invalidateQueries({ queryKey: ['carrinho'] }) })
    await waitFor(() => expect(screen.getByRole('button', { name: /Diminuir quantidade/ })).toBeEnabled())
    expect(screen.getByRole('button', { name: /Aumentar quantidade/ })).toBeDisabled()
    const inicio = chamadas.length
    await user.click(screen.getByRole('button', { name: /Diminuir quantidade/ }))
    await waitFor(() => expect(screen.getByLabelText(`1 unidades de ${produtoTeste.nome}`)).toBeVisible())
    expect(chamadas[inicio].method).toBe('GET')
    expect(chamadas.slice(inicio).find(call => call.method === 'PUT')?.body?.quantidade).toBe(1)
    await waitFor(() => expect(screen.getByRole('button', { name: /Remover Blusa/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Remover Blusa/ }))
    await waitFor(() => expect(carrinhos.get(cartIdTeste)).toBe(0))
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
  })

  it('preserva o UUID quando o GET retorna produto inexistente e permite remoção explícita', async () => {
    carrinhos.set(cartIdTeste, 1)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    falhaConsulta = 404
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.erro).toBeTruthy())
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
    expect(chamadas.every((call) => call.method === 'GET')).toBe(true)
    act(() => result.current.remover(produtoTeste.id))
    await waitFor(() => expect(result.current.carrinho?.itens).toEqual([]))
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
  })

  it('serializa reduções usando a quantidade atual do servidor', async () => {
    carrinhos.set(cartIdTeste, 3)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.quantidade).toBe(3))
    act(() => { result.current.ajustar(produtoTeste.id, -1); result.current.ajustar(produtoTeste.id, -1) })
    await waitFor(() => expect(result.current.quantidade).toBe(1))
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    expect(chamadas.filter((call) => call.method === 'PUT').map((call) => call.body?.quantidade)).toEqual([2, 1])
    expect(maximoAtivas).toBe(1)
  })

  it('reduz a quantidade alterada por outra aba sem sobrescrever unidades adicionais', async () => {
    carrinhos.set(cartIdTeste, 3)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.quantidade).toBe(3))
    carrinhos.set(cartIdTeste, 4)
    act(() => result.current.ajustar(produtoTeste.id, -1))
    await waitFor(() => expect(chamadas.some(call => call.method === 'PUT')).toBe(true))
    await waitFor(() => expect(result.current.ocupado).toBe(false))
    expect(chamadas.find(call => call.method === 'PUT')?.body?.quantidade).toBe(3)
    expect(carrinhos.get(cartIdTeste)).toBe(3)
  })

  it('coordena reduções de dois caches independentes pelo mesmo Web Lock', async () => {
    carrinhos.set(cartIdTeste, 3)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    let fila = Promise.resolve<unknown>(undefined)
    const request = vi.fn((_nome: string, callback: () => Promise<unknown>) => {
      const atual = fila.then(callback, callback)
      fila = atual.catch(() => undefined)
      return atual
    })
    vi.stubGlobal('navigator', { locks: { request } })
    const outroClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const OutraAba = ({ children }: { children: ReactNode }) => <QueryClientProvider client={outroClient}><CarrinhoProvider>{children}</CarrinhoProvider></QueryClientProvider>
    const primeira = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    const segunda = renderHook(() => useCarrinho(), { wrapper: OutraAba })
    try {
      await waitFor(() => expect(primeira.result.current.quantidade).toBe(3))
      await waitFor(() => expect(segunda.result.current.quantidade).toBe(3))
      act(() => { primeira.result.current.ajustar(produtoTeste.id, -1); segunda.result.current.ajustar(produtoTeste.id, -1) })
      await waitFor(() => expect(chamadas.filter(call => call.method === 'PUT')).toHaveLength(2))
      await waitFor(() => expect(primeira.result.current.ocupado || segunda.result.current.ocupado).toBe(false))
      expect(chamadas.filter(call => call.method === 'PUT').map(call => call.body?.quantidade)).toEqual([2, 1])
      expect(carrinhos.get(cartIdTeste)).toBe(1)
      expect(maximoAtivas).toBe(1)
    } finally {
      segunda.unmount()
      outroClient.clear()
    }
  })

  it('carrega uma sacola indisponível sem cache anterior e permite reduzi-la', async () => {
    carrinhos.set(cartIdTeste, 2)
    estoqueAtual = 1
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/ }))
    const reduzir = await screen.findByRole('button', { name: /Diminuir quantidade/ })
    await waitFor(() => expect(reduzir).toBeEnabled())
    expect(screen.getByRole('button', { name: /Aumentar quantidade/ })).toBeDisabled()
    await user.click(reduzir)
    await waitFor(() => expect(carrinhos.get(cartIdTeste)).toBe(1))
  })

  it('preserva o estado e não envia quantidade calculada do cache quando a consulta falha', async () => {
    carrinhos.set(cartIdTeste, 3)
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.quantidade).toBe(3))
    falhaConsulta = 503
    act(() => result.current.ajustar(produtoTeste.id, -1))
    await waitFor(() => expect(result.current.erro).toBeTruthy())
    expect(chamadas.filter(call => call.method === 'PUT')).toHaveLength(0)
    expect(carrinhos.get(cartIdTeste)).toBe(3)
  })

  it('não descarta o UUID em um 404 sem código de carrinho expirado', async () => {
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    falha = 404
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.erro).toBeTruthy())
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
  })

  it('sincroniza mudança de identificador vinda de outra aba', async () => {
    const { result } = renderHook(() => useCarrinho(), { wrapper: Wrapper })
    carrinhos.set(cartIdTeste, 2)
    act(() => {
      localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
      fireEvent(window, new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: cartIdTeste }))
    })
    await waitFor(() => expect(result.current.quantidade).toBe(2))
    expect(result.current.id).toBe(cartIdTeste)
  })
})

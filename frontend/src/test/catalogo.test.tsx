import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { CART_STORAGE_KEY } from '../services/carrinho-storage'
import { cartIdTeste, produtoTeste, respostaCarrinho } from './carrinho-fixture'

const produtos = [
  { ...produtoTeste, nome: 'Blusa Branca Serena', categoria: 'Blusas', descricao: null },
  { ...produtoTeste, id: 'a17a0000-0000-4000-8000-000000000002', nome: 'Vestido Floral Aurora', categoria: 'Vestidos', descricao: 'Uma peça atemporal e delicada.' },
  { ...produtoTeste, id: 'a17a0000-0000-4000-8000-000000000003', nome: 'Calça Bege Cidade', categoria: 'Calças', descricao: 'Alfaiataria leve.' },
  { ...produtoTeste, id: 'a17a0000-0000-4000-8000-000000000004', nome: 'Conjunto Rosa Presença', categoria: 'Conjuntos', descricao: null },
]

describe('Busca e filtros do catálogo', () => {
  let client: QueryClient
  beforeEach(() => {
    localStorage.clear()
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/auth/me')) return Response.json({}, { status: 401 })
      if (String(url).endsWith('/produtos')) return Response.json(produtos)
      if (String(url).endsWith('/carrinho')) return Response.json(respostaCarrinho(cartIdTeste, 2))
      throw new Error('Unexpected request')
    }))
  })
  afterEach(() => { client.clear() })

  async function montar(path = '/') {
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><CarrinhoProvider><App /></CarrinhoProvider></MemoryRouter></QueryClientProvider>)
    if (!path.startsWith('/checkout')) await waitFor(() => expect(document.getElementById('produtos')).toHaveAttribute('aria-busy', 'false'))
  }

  async function buscar(termo: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Buscar produtos' }))
    const campo = screen.getByRole('searchbox', { name: 'Pesquisar produtos' })
    await user.clear(campo)
    await user.type(campo, termo)
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
  }

  const cards = () => [...document.querySelectorAll('.product-card h3')].map((element) => element.textContent)

  it('abre a busca com foco, fecha com Escape e oferece acesso à conta', async () => {
    await montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Buscar produtos' }))
    expect(screen.getByRole('searchbox')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Buscar produtos' })).toHaveFocus()
    expect(screen.getByRole('link', { name: /Minha conta/ })).toHaveAttribute('href', '/conta')
  })

  it('busca por nome sem diferenciar caixa ou acentos', async () => {
    await montar()
    await buscar('CALCA BEGE')
    await waitFor(() => expect(cards()).toEqual(['Calça Bege Cidade']))
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('também encontra palavras da descrição', async () => {
    await montar()
    await buscar('ATEMPORAL')
    await waitFor(() => expect(cards()).toEqual(['Vestido Floral Aurora']))
  })

  it('combina categoria do Header com a busca e preserva o termo nos links', async () => {
    await montar()
    await buscar('Serena')
    const user = userEvent.setup()
    await user.click(screen.getByText('Categorias', { selector: 'summary' }))
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const vestidos = within(nav).getByRole('link', { name: 'Vestidos' })
    expect(vestidos.getAttribute('href')).toContain('busca=Serena')
    await user.click(vestidos)
    expect(await screen.findByText(/Nenhuma peça encontrada/)).toBeVisible()
    expect(cards()).toEqual([])
    await user.click(within(screen.getByRole('group', { name: 'Filtrar por categoria' })).getByRole('button', { name: 'Blusas' }))
    await waitFor(() => expect(cards()).toEqual(['Blusa Branca Serena']))
  })

  it('limpa o estado vazio e restaura os produtos reais', async () => {
    await montar()
    await buscar('inexistente')
    expect(await screen.findByText(/Nenhuma peça encontrada/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(cards()).toHaveLength(4))
  })

  it('restaura os filtros da URL e fecha o menu mobile ao trocar a categoria', async () => {
    await montar('/?busca=bege&categoria=Cal%C3%A7as#produtos')
    await waitFor(() => expect(cards()).toEqual(['Calça Bege Cidade']))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const nav = screen.getByRole('navigation', { name: 'Navegação mobile' })
    await user.click(within(nav).getByRole('link', { name: 'Blusas' }))
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).toBeNull()
    expect(await screen.findByText(/Nenhuma peça encontrada/)).toBeVisible()
    expect(screen.getByText(/Busca por “bege”/)).toBeVisible()
  })

  it('permite buscar a partir do checkout e leva ao catálogo', async () => {
    await montar('/checkout')
    await buscar('floral')
    await waitFor(() => expect(cards()).toEqual(['Vestido Floral Aurora']))
    expect(document.getElementById('produtos')).toBeInTheDocument()
  })

  it('preserva os itens da sacola ao filtrar e mantém a navegação para checkout', async () => {
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)
    await montar()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir carrinho, 2 unidades' })).toBeVisible())
    await buscar('calca')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir carrinho, 2 unidades' }))
    const drawer = screen.getByRole('dialog', { name: /Sua sacola/ })
    expect(await within(drawer).findByText('Blusa Serena')).toBeVisible()
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
    await userEvent.click(within(drawer).getByRole('link', { name: 'Finalizar compra' }))
    expect(await screen.findByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
  })

  it('Nossas peças abre o catálogo completo e não uma página fictícia', async () => {
    await montar('/?categoria=Vestidos#produtos')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação' })).getByRole('link', { name: 'Nossas peças' }))
    await waitFor(() => expect(cards()).toHaveLength(4))
    expect(document.getElementById('produtos')).toBeInTheDocument()
  })
})

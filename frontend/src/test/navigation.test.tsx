import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { produtoTeste } from './carrinho-fixture'

describe('Navegação da loja', () => {
  let client: QueryClient
  const scroll = vi.fn()

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    scroll.mockClear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => String(url).endsWith('/auth/me') ? Response.json({}, { status: 401 }) : Response.json(['Vestidos', 'Blusas', 'Calças', 'Conjuntos'].map((categoria, index) => ({ ...produtoTeste, id: `a17a0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, categoria })))))
  })

  afterEach(() => { client.clear() })

  function montar(path = '/') {
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><CarrinhoProvider><App /></CarrinhoProvider></MemoryRouter></QueryClientProvider>)
  }

  it.each([['Início', 'inicio'], ['Nova coleção', 'produtos'], ['Nossas peças', 'produtos']])('repete a navegação do footer para %s mesmo com a mesma âncora', async (nome, id) => {
    montar(`/#${id}`)
    const nav = screen.getByRole('navigation', { name: 'Navegação' })
    const quantidade = scroll.mock.calls.length
    await userEvent.click(within(nav).getByRole('link', { name: nome }))
    await waitFor(() => expect(scroll.mock.calls.length).toBeGreaterThan(quantidade))
    expect((scroll.mock.contexts.at(-1) as HTMLElement).id).toBe(id)
  })

  it('repete o CTA da Home e leva ao catálogo', async () => {
    montar('/#produtos')
    const quantidade = scroll.mock.calls.length
    await userEvent.click(screen.getByRole('link', { name: 'Comprar agora' }))
    await waitFor(() => expect(scroll.mock.calls.length).toBeGreaterThan(quantidade))
    expect((scroll.mock.contexts.at(-1) as HTMLElement).id).toBe('produtos')
  })

  it.each(['Início', 'Nova coleção', 'Vestidos', 'Blusas', 'Calças', 'Conjuntos'])('fecha o menu mobile após navegar por %s', async (nome) => {
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const nav = screen.getByRole('navigation', { name: 'Navegação mobile' })
    await user.click(within(nav).getByRole('link', { name: nome }))
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
    expect((scroll.mock.contexts.at(-1) as HTMLElement).id).toBe(nome === 'Início' ? 'inicio' : 'produtos')
  })

  it('fecha o menu ao clicar no logo e permite abri-lo novamente', async () => {
    montar('/#inicio')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: /Alva Modas/ }))
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus()
  })

  it('fecha as categorias após navegar e com Escape', async () => {
    montar('/#produtos')
    const user = userEvent.setup()
    await user.click(screen.getByText('Categorias', { selector: 'summary' }))
    expect(document.querySelector('details')).toHaveAttribute('open')
    await user.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Vestidos' }))
    expect(document.querySelector('details')).not.toHaveAttribute('open')
    await user.click(screen.getByText('Categorias', { selector: 'summary' }))
    await user.keyboard('{Escape}')
    expect(document.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Categorias', { selector: 'summary' })).toHaveFocus()
  })

  it('navega do checkout para a seção real do catálogo pelo footer', async () => {
    montar('/checkout')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação' })).getByRole('link', { name: 'Nossas peças' }))
    await waitFor(() => expect(document.getElementById('produtos')).toBeInTheDocument())
    expect((scroll.mock.contexts.at(-1) as HTMLElement).id).toBe('produtos')
  })

  it('reposiciona a seção quando o catálogo termina de carregar após voltar do checkout', async () => {
    let responder!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn((url: unknown) => String(url).endsWith('/auth/me') ? Promise.resolve(Response.json({}, { status: 401 })) : new Promise<Response>((resolve) => { responder = resolve })))
    montar('/checkout')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação' })).getByRole('link', { name: 'Nossas peças' }))
    expect(document.getElementById('produtos')).toHaveAttribute('aria-busy', 'true')
    scroll.mockClear()
    await act(async () => { responder(Response.json([])) })
    await waitFor(() => expect(document.getElementById('produtos')).toHaveAttribute('aria-busy', 'false'))
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect((scroll.mock.contexts.at(-1) as HTMLElement).id).toBe('produtos')
  })
})

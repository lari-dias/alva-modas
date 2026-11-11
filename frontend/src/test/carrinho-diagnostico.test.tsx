import { BrowserRouter, useNavigate } from 'react-router-dom'
import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { CartDiagnostics } from '../components/CartDiagnostics'
import { ProductCard } from '../components/ProductCard'
import { diagnosticoCarrinhoAtivo, lerRegistrosCarrinho, registrarCarrinho, presencaArmazenamento } from '../services/carrinho-diagnostico'
import { serializarCarrinho } from '../services/carrinho-lock'
import { produtoTeste, cartIdTeste, respostaCarrinho } from './carrinho-fixture'

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

function Navegacao() {
  const navegar = useNavigate()
  return <><button onClick={() => navegar('/?diagnostico-carrinho=1')}>Ativar diagnóstico</button><button onClick={() => navegar('/')}>Desativar diagnóstico</button></>
}

function montar(estoque = 5) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<BrowserRouter><QueryClientProvider client={client}><CarrinhoProvider><Navegacao /><ProductCard produto={{ ...produtoTeste, estoque }} /><CartDiagnostics /></CarrinhoProvider></QueryClientProvider></BrowserRouter>)
}

it('não ativa nem registra sem o parâmetro exato', () => {
  for (const url of ['/', '/?diagnostico-carrinho=0', '/?diagnostico-carrinho=true']) {
    window.history.replaceState(null, '', url)
    expect(diagnosticoCarrinhoAtivo()).toBe(false)
  }
  const antes = lerRegistrosCarrinho()
  registrarCarrinho('handler adicionar')
  expect(lerRegistrosCarrinho()).toBe(antes)
  montar()
  expect(screen.queryByLabelText('Diagnóstico temporário do carrinho')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Adicionar/ })).not.toHaveAttribute('data-diagnostico-motivos')
})

it('mostra bloqueio real e presença sem revelar identificadores', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  localStorage.setItem('alva-modas:checkout-pending', cartIdTeste)
  montar(0)
  const botao = screen.getByRole('button', { name: /Adicionar/ })
  expect(botao).toBeDisabled()
  const antes = lerRegistrosCarrinho().length
  fireEvent.click(botao)
  expect(lerRegistrosCarrinho().slice(antes).some(e => e.evento === 'handler adicionar')).toBe(false)
  await waitFor(() => expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).toHaveTextContent('estoque insuficiente'))
  const painel = screen.getByLabelText('Diagnóstico temporário do carrinho')
  expect(painel).toHaveTextContent('checkout pendente')
  expect(painel).not.toHaveTextContent(cartIdTeste)
  expect(painel).not.toHaveTextContent(produtoTeste.id)
  expect(localStorage.getItem('alva-modas:checkout-pending')).toBe(cartIdTeste)
})

it('observa toque, handler, lock e HTTP sem mudar o resultado', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(respostaCarrinho(cartIdTeste, 1))))
  montar()
  const botao = screen.getByRole('button', { name: /Adicionar/ })
  const antes = lerRegistrosCarrinho().length
  fireEvent.pointerDown(botao)
  fireEvent.click(botao)
  await waitFor(() => expect(localStorage.getItem('alva-modas:cart-id')).toBe(cartIdTeste))
  const eventos = lerRegistrosCarrinho().slice(antes).map(e => e.evento)
  expect(eventos).toEqual(expect.arrayContaining(['toque no botão', 'handler adicionar', 'fila local: aguardando', 'fila local: adquirido', 'POST iniciado', 'resposta HTTP', 'mutation concluída']))
  expect(JSON.stringify(lerRegistrosCarrinho())).not.toContain(cartIdTeste)
})

it('registra status de falha sem copiar a resposta privada da API', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'segredo@example.test' }, { status: 503 })))
  montar()
  fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
  await waitFor(() => expect(lerRegistrosCarrinho().some(e => e.evento === 'resposta HTTP' && e.status === 503)).toBe(true))
  await waitFor(() => expect(lerRegistrosCarrinho().at(-1)?.evento).not.toBe('resposta HTTP'))
  expect(JSON.stringify(lerRegistrosCarrinho())).not.toContain('segredo@example.test')
})

it('mantém a operação aguardando o lock e propaga o mesmo erro', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  let liberar!: () => void
  const barreira = new Promise<void>(resolve => { liberar = resolve })
  const original = new Error('conteúdo privado não deve ser registrado')
  const operacao = vi.fn(async () => { throw original })
  vi.stubGlobal('navigator', { locks: { request: async (_nome: string, callback: () => Promise<unknown>) => { await barreira; return callback() } } })
  const promessa = serializarCarrinho(operacao)
  expect(operacao).not.toHaveBeenCalled()
  expect(lerRegistrosCarrinho().at(-1)?.evento).toBe('lock: aguardando')
  await act(async () => { liberar(); await expect(promessa).rejects.toBe(original) })
  expect(JSON.stringify(lerRegistrosCarrinho())).not.toContain(original.message)
  expect(lerRegistrosCarrinho().slice(-4).map(e => e.evento)).toEqual(['lock: adquirido', 'lock: executando', 'lock: execução falhou', 'lock: liberado'])
})

it('acompanha navegação, remove listeners e timer e limpa histórico ao desativar', () => {
  const intervalo = vi.spyOn(window, 'setInterval')
  const limpar = vi.spyOn(window, 'clearInterval')
  const adicionar = vi.spyOn(document, 'addEventListener')
  const remover = vi.spyOn(document, 'removeEventListener')
  const adicionarWindow = vi.spyOn(window, 'addEventListener')
  const removerWindow = vi.spyOn(window, 'removeEventListener')
  montar(0)
  fireEvent.click(screen.getByText('Ativar diagnóstico'))
  expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Adicionar/ })).toHaveAttribute('data-diagnostico-motivos')
  const timer = intervalo.mock.results.at(-1)?.value
  const toque = adicionar.mock.calls.find(([tipo]) => tipo === 'pointerdown')?.[1]
  fireEvent.click(screen.getByText('Desativar diagnóstico'))
  expect(screen.queryByLabelText('Diagnóstico temporário do carrinho')).not.toBeInTheDocument()
  expect(limpar).toHaveBeenCalledWith(timer)
  expect(remover).toHaveBeenCalledWith('pointerdown', toque, true)
  for (const tipo of ['error', 'unhandledrejection']) {
    const listener = adicionarWindow.mock.calls.find(([evento]) => evento === tipo)?.[1]
    expect(removerWindow).toHaveBeenCalledWith(tipo, listener)
  }
  expect(lerRegistrosCarrinho()).toEqual([])
  expect(screen.getByRole('button', { name: /Adicionar/ })).not.toHaveAttribute('data-diagnostico-motivos')
})

it('cancela o timer na desmontagem direta', () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  const intervalo = vi.spyOn(window, 'setInterval')
  const limpar = vi.spyOn(window, 'clearInterval')
  const tela = montar()
  const timer = intervalo.mock.results.at(-1)?.value
  tela.unmount()
  expect(limpar).toHaveBeenCalledWith(timer)
})

it('mostra armazenamento inacessível sem revelar a exceção', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  montar()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('privado') })
  expect(presencaArmazenamento()).toEqual({ acessivel: false, cartId: null, checkoutPendente: null })
  await waitFor(() => expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).toHaveTextContent('"acessivel": false'))
  expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).not.toHaveTextContent('privado')
})

it('mostra consulta pendente e mantém o botão bloqueado', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  localStorage.setItem('alva-modas:cart-id', cartIdTeste)
  let responder!: (resposta: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { responder = resolve })))
  montar()
  await waitFor(() => expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled())
  await waitFor(() => expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).toHaveTextContent('consulta em andamento'))
  await act(async () => { responder(Response.json(respostaCarrinho(cartIdTeste, 0))) })
  await waitFor(() => expect(screen.getByRole('button', { name: /Adicionar/ })).toBeEnabled())
})

it('identifica mutation pausada sem enviar requisição enquanto offline', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  const fetchMock = vi.fn(async () => Response.json(respostaCarrinho(cartIdTeste, 1)))
  vi.stubGlobal('fetch', fetchMock)
  montar()
  try {
    onlineManager.setOnline(false)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(screen.getByLabelText('Diagnóstico temporário do carrinho')).toHaveTextContent('"pausada":true'))
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  } finally {
    await act(async () => { onlineManager.setOnline(true) })
  }
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
})

it('distingue falha na aquisição sem executar a operação', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  const erro = new Error('privado')
  vi.stubGlobal('navigator', { locks: { request: () => Promise.reject(erro) } })
  const executar = vi.fn()
  await expect(serializarCarrinho(executar)).rejects.toBe(erro)
  expect(executar).not.toHaveBeenCalled()
  expect(lerRegistrosCarrinho().at(-1)?.evento).toBe('lock: aquisição falhou')
})

it('só registra liberação após o gerenciador resolver a aquisição', async () => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  let liberar!: () => void
  const barreira = new Promise<void>(resolve => { liberar = resolve })
  vi.stubGlobal('navigator', { locks: { request: async (_nome: string, callback: () => Promise<number>) => { const valor = await callback(); await barreira; return valor } } })
  const resultado = serializarCarrinho(async () => 42)
  await waitFor(() => expect(lerRegistrosCarrinho().at(-1)?.evento).toBe('lock: execução concluída'))
  liberar()
  await expect(resultado).resolves.toBe(42)
  expect(lerRegistrosCarrinho().at(-1)?.evento).toBe('lock: liberado')
})

it.each([
  ['estoque insuficiente', 5, 5, 1],
  ['limite de unidades', 1, 200, 100],
  ['limite por produto', 100, 200, 1],
  ['limite de produtos', 1, 5, 20],
] as const)('explica o bloqueio: %s', async (motivo, quantidade, estoque, distintos) => {
  window.history.replaceState(null, '', '/?diagnostico-carrinho=1')
  localStorage.setItem('alva-modas:cart-id', cartIdTeste)
  const carrinho = respostaCarrinho(cartIdTeste, quantidade)
  carrinho.itens = Array.from({ length: distintos }, (_, indice) => ({ ...carrinho.itens[0], produto: { ...produtoTeste, estoque, id: motivo === 'limite de produtos' ? `a17a0000-0000-4000-8000-${String(indice + 200).padStart(12, '0')}` : indice === 0 ? produtoTeste.id : `a17a0000-0000-4000-8000-${String(indice + 200).padStart(12, '0')}` } }))
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(carrinho)))
  montar(estoque)
  await waitFor(() => expect(screen.getByRole('button', { name: /Adicionar/ }).dataset.diagnosticoMotivos).toContain(motivo))
  expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
  cleanup()
})


import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CarrinhoProvider } from '../providers/CarrinhoProvider'
import { CART_STORAGE_KEY } from '../services/carrinho-storage'
import { CHECKOUT_PENDING_KEY } from '../services/checkout-tentativa'
import { cartIdTeste, produtoTeste, respostaCarrinho } from './carrinho-fixture'
import type { EmailStatus, PedidoConfirmado } from '../types/checkout'

describe('Checkout', () => {
  let client: QueryClient
  let quantidade: number
  let statusCart: number
  let modo: 'sucesso' | '400' | '409' | '503' | 'rede' | 'invalida' | 'aguardando'
  let emailStatus: EmailStatus
  let posts: Array<{ body: unknown; id: string | null }>
  let liberar: ((response: Response) => void) | undefined

  const pedido: PedidoConfirmado = {
    idPedido: 'a17a0000-0000-4000-8000-000000000088',
    status: 'CONFIRMADO',
    itens: [
      {
        produtoId: produtoTeste.id,
        nomeProduto: 'Blusa no momento da compra',
        quantidade: 2,
        precoUnitarioCentavos: 7990,
        subtotalCentavos: 15980,
      },
    ],
    totalCentavos: 15980,
    emailStatus: 'ACEITO_PELO_SMTP',
  }

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(CART_STORAGE_KEY, cartIdTeste)

    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    quantidade = 2
    statusCart = 200
    modo = 'sucesso'
    emailStatus = 'ACEITO_PELO_SMTP'
    posts = []
    liberar = undefined

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, options: RequestInit = {}) => {
        const path = new URL(String(input)).pathname

        if (path === '/auth/me') {
          return Response.json({}, { status: 401 })
        }

        if (path === '/produtos') {
          return Response.json([produtoTeste])
        }

        if (path === '/carrinho') {
          if (statusCart !== 200) {
            return Response.json(
              { code: statusCart === 404 ? 'CART_NOT_FOUND' : undefined },
              { status: statusCart },
            )
          }

          return Response.json(respostaCarrinho(cartIdTeste, quantidade))
        }

        if (path !== '/finalizar-compra') {
          throw new Error('Unexpected test URL')
        }

        posts.push({
          body: JSON.parse(String(options.body)),
          id: new Headers(options.headers).get('X-Cart-Id'),
        })

        if (modo === 'rede') {
          throw new TypeError('Failed to fetch')
        }

        if (modo === '400' || modo === '409' || modo === '503') {
          return Response.json(
            { message: 'Test API failure' },
            { status: Number(modo) },
          )
        }

        if (modo === 'invalida') {
          return Response.json({ idPedido: 'invalid' }, { status: 201 })
        }

        if (modo === 'aguardando') {
          return new Promise<Response>((resolve) => {
            liberar = resolve
          })
        }

        return Response.json({ ...pedido, emailStatus }, { status: 201 })
      }),
    )
  })

  afterEach(() => {
    client.clear()
  })

  function montar(path = '/checkout') {
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <CarrinhoProvider>
            <App />
          </CarrinhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  async function preencher() {
    const user = userEvent.setup()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      ).toBeEnabled(),
    )

    await user.type(screen.getByLabelText('Nome completo'), '  Maria Silva  ')
    await user.type(
      screen.getByLabelText('E-mail'),
      '  cliente@example.test  ',
    )

    return user
  }

  it('valida nome obrigatório e e-mail inválido sem fazer POST', async () => {
    montar()

    const user = userEvent.setup()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      ).toBeEnabled(),
    )

    await user.type(screen.getByLabelText('E-mail'), 'invalido')
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(
      await screen.findByText(
        'Informe seu nome com pelo menos 2 caracteres.',
      ),
    ).toBeVisible()

    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()

    expect(screen.getByLabelText('Nome completo')).toHaveAttribute(
      'aria-invalid',
      'true',
    )

    expect(posts).toHaveLength(0)
  })

  it('não permite finalizar um carrinho vazio', async () => {
    quantidade = 0
    montar()

    expect(
      await screen.findByRole('heading', {
        name: 'Sua sacola está vazia',
      }),
    ).toBeVisible()

    expect(
      screen.queryByRole('button', { name: 'Confirmar pedido' }),
    ).toBeNull()

    expect(posts).toHaveLength(0)
  })

  it('preserva o tratamento de carrinho expirado', async () => {
    statusCart = 404
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'expirou ou não existe mais',
    )

    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(posts).toHaveLength(0)
  })

  it('envia apenas nome/e-mail e UUID; mostra os valores confirmados e limpa o carrinho', async () => {
    montar()
    const user = await preencher()

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(
      await screen.findByRole('heading', { name: 'Pedido confirmado' }),
    ).toHaveFocus()

    expect(posts).toEqual([
      {
        id: cartIdTeste,
        body: {
          nome: 'Maria Silva',
          email: 'cliente@example.test',
        },
      },
    ])

    expect(screen.getByText(pedido.idPedido)).toBeVisible()
    expect(screen.getByText('Blusa no momento da compra')).toBeVisible()
    expect(screen.getAllByText(/R\$\s*159,80/)).toHaveLength(2)
    expect(screen.getByText(/aceita pelo servidor SMTP/)).toBeVisible()
    expect(screen.getByText('Nenhum pagamento foi realizado.')).toBeVisible()

    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(CHECKOUT_PENDING_KEY)).toBeNull()
    expect(client.getQueryData(['carrinho', cartIdTeste])).toBeUndefined()

    expect(
      screen.getByRole('button', { name: 'Abrir carrinho' }),
    ).toBeVisible()

    expect(
      screen.queryByRole('button', { name: 'Confirmar pedido' }),
    ).toBeNull()
  })

  it('confirma o pedido quando o e-mail é aceito pela API Resend', async () => {
    emailStatus = 'ACEITO_PELA_API'
    montar()

    const user = await preencher()

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(
      await screen.findByRole('heading', { name: 'Pedido confirmado' }),
    ).toBeVisible()

    expect(screen.getByText(pedido.idPedido)).toBeVisible()
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(CHECKOUT_PENDING_KEY)).toBeNull()
    expect(posts).toHaveLength(1)
  })

  it('mostra carregamento e impede cliques e submits duplicados', async () => {
    modo = 'aguardando'
    montar()
    await preencher()

    const form = screen
      .getByRole('button', { name: 'Confirmar pedido' })
      .closest('form')!

    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })

    await waitFor(() => expect(posts).toHaveLength(1))

    expect(
      screen.getByRole('button', { name: 'Confirmando pedido...' }),
    ).toBeDisabled()

    expect(screen.getByLabelText('Nome completo')).toBeDisabled()
    expect(localStorage.getItem(CHECKOUT_PENDING_KEY)).toBe(cartIdTeste)

    fireEvent.submit(form)
    expect(posts).toHaveLength(1)

    await act(async () => {
      liberar?.(Response.json(pedido, { status: 201 }))
    })

    expect(
      await screen.findByRole('heading', { name: 'Pedido confirmado' }),
    ).toBeVisible()

    expect(posts).toHaveLength(1)
  })

  it.each(['400', '409'] as const)(
    'informa rejeição segura %s sem limpar o carrinho ou repetir automaticamente',
    async (status) => {
      modo = status
      montar()

      const user = await preencher()

      await user.click(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      )

      expect(await screen.findByRole('alert')).toBeVisible()

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Confirmar pedido' }),
        ).toBeEnabled(),
      )

      expect(posts).toHaveLength(1)
      expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)
      expect(localStorage.getItem(CHECKOUT_PENDING_KEY)).toBeNull()

      expect(
        screen.queryByRole('heading', { name: 'Pedido confirmado' }),
      ).toBeNull()

      modo = 'sucesso'

      await user.click(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      )

      expect(
        await screen.findByRole('heading', { name: 'Pedido confirmado' }),
      ).toBeVisible()

      expect(posts).toHaveLength(2)
    },
  )

  it.each(['rede', '503', 'invalida'] as const)(
    'bloqueia reenvio após resultado incerto: %s, inclusive ao reabrir a página',
    async (failure) => {
      modo = failure
      const view = montar()
      const user = await preencher()

      await user.click(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      )

      expect(
        await screen.findByRole('heading', {
          name: 'Confirmação aguardando verificação',
        }),
      ).toBeVisible()

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não envie novamente nem refaça a compra',
      )

      expect(
        screen.queryByRole('button', { name: 'Confirmar pedido' }),
      ).toBeNull()

      expect(posts).toHaveLength(1)
      expect(localStorage.getItem(CHECKOUT_PENDING_KEY)).toBe(cartIdTeste)
      expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(cartIdTeste)

      expect(
        Object.values(localStorage).every(
          (value) => value === cartIdTeste,
        ),
      ).toBe(true)

      view.unmount()
      montar()

      expect(
        await screen.findByRole('heading', {
          name: 'Confirmação aguardando verificação',
        }),
      ).toBeVisible()

      expect(posts).toHaveLength(1)
    },
  )

  it.each(['FALHOU', 'DESABILITADO'] as const)(
    'confirma a venda sem afirmar envio de e-mail: %s',
    async (status) => {
      emailStatus = status
      montar()

      const user = await preencher()

      await user.click(
        screen.getByRole('button', { name: 'Confirmar pedido' }),
      )

      expect(
        await screen.findByRole('heading', { name: 'Pedido confirmado' }),
      ).toBeVisible()

      expect(screen.getByRole('status')).toHaveTextContent(
        status === 'FALHOU'
          ? 'envio do e-mail não foi confirmado'
          : 'envio de e-mail está desabilitado',
      )

      expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
      expect(posts).toHaveLength(1)
    },
  )

  it('navega da sacola ao checkout e retorna ao catálogo sem perder a HomePage', async () => {
    montar('/')

    const user = userEvent.setup()

    await screen.findByText(produtoTeste.nome)

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Abrir carrinho, 2 unidades/,
        }),
      ).toBeVisible(),
    )

    await user.click(
      screen.getByRole('button', { name: /Abrir carrinho/ }),
    )

    const link = await screen.findByRole('link', {
      name: 'Finalizar compra',
    })

    await user.click(link)

    expect(
      await screen.findByRole('heading', {
        name: 'Finalizar compra',
      }),
    ).toBeVisible()

    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(
      screen.getByRole('link', { name: 'Continuar comprando' }),
    )

    expect(
      await screen.findByRole('heading', { name: /Nova.*Coleção/ }),
    ).toBeVisible()

    expect(
      screen.getByRole('heading', { name: 'Destaques da Alva' }),
    ).toBeVisible()

    expect(posts).toHaveLength(0)
  })
})


import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import type { PedidoConfirmado, EmailStatus } from '../types/checkout'
import { formatarCentavos } from '../services/formatar-preco'

const mensagensEmail: Record<EmailStatus, string> = {
  ACEITO_PELO_SMTP:
    'A confirmação foi aceita pelo servidor SMTP. Isso não garante a entrega na sua caixa de entrada.',
  ACEITO_PELA_API:
    'O pedido foi confirmado e o e-mail de confirmação foi aceito pelo serviço de envio. Isso não garante a entrega na sua caixa de entrada.',
  FALHOU:
    'Seu pedido foi registrado, mas o envio do e-mail não foi confirmado. Não refaça a compra por esse motivo.',
  DESABILITADO:
    'O envio de e-mail está desabilitado neste ambiente. Seu pedido foi registrado.',
}

export function CheckoutSuccess({ pedido }: { pedido: PedidoConfirmado }) {
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  return (
    <section
      className="checkout-success checkout-panel"
      aria-labelledby="checkout-success-title"
    >
      <CircleCheck size={40} strokeWidth={1.3} aria-hidden="true" />

      <h2 id="checkout-success-title" ref={titulo} tabIndex={-1}>
        Pedido confirmado
      </h2>

      <p className="checkout-order-id">
        Número do pedido: <strong>{pedido.idPedido}</strong>
      </p>

      <p className="checkout-confirmed-status">
        Status: {pedido.status}
      </p>

      <p className="checkout-email-status" role="status">
        {mensagensEmail[pedido.emailStatus]}
      </p>

      <ul className="checkout-confirmed-items">
        {pedido.itens.map((item) => (
          <li key={item.produtoId}>
            <div>
              <h3>{item.nomeProduto}</h3>
              <p>
                {item.quantidade} × {formatarCentavos(item.precoUnitarioCentavos)}
              </p>
            </div>

            <strong>
              <span className="sr-only">Subtotal: </span>
              {formatarCentavos(item.subtotalCentavos)}
            </strong>
          </li>
        ))}
      </ul>

      <div className="checkout-total">
        <span>Total confirmado</span>
        <strong>{formatarCentavos(pedido.totalCentavos)}</strong>
      </div>

      <p className="checkout-payment-note">
        Nenhum pagamento foi realizado.
      </p>

      <Link className="primary-button checkout-return" to="/#produtos">
        Voltar à loja
      </Link>
    </section>
  )
}

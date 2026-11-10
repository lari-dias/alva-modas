import type { Carrinho } from '../types/carrinho'
import { formatarCentavos } from '../services/formatar-preco'

export function CheckoutSummary({ carrinho }: { carrinho: Carrinho }) {
  return (
    <section className="checkout-summary checkout-panel" aria-labelledby="checkout-summary-title">
      <h2 id="checkout-summary-title">Resumo do pedido</h2>
      <ul className="checkout-summary-items">{carrinho.itens.map((item) => (
        <li key={item.produto.id} className="checkout-summary-item">
          <img src={item.produto.imagemUrl} alt={item.produto.nome} width={60} height={76} />
          <div><h3>{item.produto.nome}</h3><p>Quantidade: {item.quantidade}</p><p>{formatarCentavos(item.precoUnitarioCentavos)} por unidade</p></div>
          <strong><span className="sr-only">Subtotal: </span>{formatarCentavos(item.subtotalCentavos)}</strong>
        </li>
      ))}</ul>
      <div className="checkout-total"><span>Total</span><strong>{formatarCentavos(carrinho.totalCentavos)}</strong></div>
      <p className="checkout-muted checkout-stock-note">Os preços e o estoque serão conferidos novamente ao confirmar.</p>
    </section>
  )
}

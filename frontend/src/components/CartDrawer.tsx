import { LoaderCircle, ShoppingBag, X } from 'lucide-react'
import { useCarrinho } from '../hooks/useCarrinho'
import { useDrawerFocus } from '../hooks/useDrawerFocus'
import { formatarCentavos } from '../services/formatar-preco'
import { CartItem } from './CartItem'
import './carrinho.css'
import { Link } from 'react-router-dom'

export function CartDrawer() {
  const cart = useCarrinho()
  const { dialogRef, manterFoco } = useDrawerFocus(cart.aberto, cart.focoRetorno)
  const itens = cart.carrinho?.itens ?? []

  return (
    <dialog ref={dialogRef} id="cart-drawer" className="cart-drawer" aria-modal="true" aria-labelledby="cart-title" onCancel={(event) => { event.preventDefault(); cart.fechar() }} onClick={(event) => { if (event.target === event.currentTarget) cart.fechar() }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cart.fechar() } else manterFoco(event) }}>
      <div className="cart-drawer-panel">
        <div className="cart-drawer-header">
          <div><p className="cart-eyebrow">ALVA MODAS</p><h2 id="cart-title">Sua sacola {(!cart.id || cart.carrinho) && <span>({cart.quantidade})</span>}</h2></div>
          <button type="button" className="icon-button" onClick={cart.fechar} aria-label="Fechar carrinho" data-initial-focus><X aria-hidden="true" /></button>
        </div>
        <div className="cart-drawer-body" aria-busy={cart.ocupado}>
          {cart.erro && <div className="cart-message cart-error" role="alert"><p>{cart.erro}</p><div className="cart-error-actions">
            {cart.checkoutPendente && <Link to="/checkout" onClick={cart.fechar}>Verificar confirmação</Link>}
            {cart.id && <button type="button" onClick={cart.recarregar} disabled={cart.ocupado}>Atualizar carrinho</button>}
            <button type="button" onClick={cart.reiniciar} disabled={cart.ocupado}>Começar novo carrinho</button>
          </div></div>}
          {cart.feedback && <p className="cart-message cart-feedback" role="status">{cart.feedback}</p>}
          {cart.ocupado && !cart.checkoutPendente && <p className="cart-loading" role="status"><LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" />{cart.carregando ? 'Carregando carrinho...' : 'Atualizando carrinho...'}</p>}
          {itens.length > 0 ? (
            <ul className="cart-items">{itens.map((item) => <CartItem key={item.produto.id} item={item} ocupado={cart.ocupado} desatualizado={cart.dadosDesatualizados} unidades={cart.quantidade} onAjustar={cart.ajustar} onRemover={cart.remover} />)}</ul>
          ) : !cart.ocupado && !cart.erro ? (
            <div className="cart-empty"><ShoppingBag size={40} strokeWidth={1.2} aria-hidden="true" /><h3>Sua sacola está vazia</h3><p>Encontre suas próximas peças favoritas na nossa coleção.</p><button type="button" className="primary-button" onClick={cart.fechar}>Continuar comprando</button></div>
          ) : null}
        </div>
        <div className="cart-drawer-footer">
          {cart.carrinho && <div className="cart-total"><span>{cart.dadosDesatualizados ? 'Último total confirmado' : 'Total'}</span><strong>{formatarCentavos(cart.carrinho.totalCentavos)}</strong></div>}
          {!cart.id && !cart.ocupado && !cart.erro && <div className="cart-total"><span>Total</span><strong>{formatarCentavos(0)}</strong></div>}
          <p className="cart-stock-note">Os itens não reservam estoque.</p>
          {cart.carrinho && itens.length > 0 && !cart.ocupado && !cart.erro ? <Link to="/checkout" className="primary-button cart-checkout" onClick={cart.fechar}>Finalizar compra</Link> : <button type="button" className="primary-button cart-checkout" disabled>Finalizar compra</button>}
          <p className="cart-checkout-note">Revise seus dados antes de confirmar o pedido.</p>
        </div>
      </div>
    </dialog>
  )
}

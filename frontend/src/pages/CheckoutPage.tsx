import { Link } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { CheckoutForm } from '../components/CheckoutForm'
import { CheckoutSummary } from '../components/CheckoutSummary'
import { CheckoutSuccess } from '../components/CheckoutSuccess'
import { useCarrinho } from '../hooks/useCarrinho'
import { useCheckout } from '../hooks/useCheckout'
import './checkout.css'

export function CheckoutPage() {
  const cart = useCarrinho()
  const checkout = useCheckout()
  const vazio = !cart.id || !cart.carrinho?.itens.length

  return (
    <div className="storefront">
      <Header />
      <main className="checkout-page content-width">
        <Link to="/#produtos" className="checkout-back"><ArrowLeft size={16} aria-hidden="true" />Continuar comprando</Link>
        <div className="checkout-heading"><p>ALVA MODAS</p><h1 tabIndex={-1}>Finalizar compra</h1></div>
        {checkout.pedido ? <CheckoutSuccess pedido={checkout.pedido} /> : checkout.incerto ? (
          <section className="checkout-panel checkout-uncertain" aria-labelledby="checkout-uncertain-title">
            <h2 id="checkout-uncertain-title">Confirmação aguardando verificação</h2>
            <p role="alert">{checkout.erro ?? 'Há uma tentativa de confirmação com resultado pendente.'} Não envie novamente nem refaça a compra: o pedido pode ter sido registrado. Verifique o resultado antes de continuar.</p>
            <p>Por segurança, uma nova confirmação está bloqueada neste navegador.</p>
          </section>
        ) : cart.carregando && !cart.carrinho ? (
          <p className="checkout-loading" role="status"><LoaderCircle size={21} className="motion-safe:animate-spin" aria-hidden="true" />Carregando sua sacola...</p>
        ) : cart.erro && (!cart.carrinho || cart.dadosDesatualizados) ? (
          <section className="checkout-panel checkout-empty"><h2>Não foi possível conferir sua sacola</h2><p role="alert">{cart.erro}</p>{cart.id && <button type="button" className="primary-button checkout-return" onClick={cart.recarregar} disabled={cart.ocupado}>Atualizar sacola</button>}<Link to="/#produtos">Voltar à loja</Link></section>
        ) : vazio && !checkout.enviando ? (
          <section className="checkout-panel checkout-empty"><h2>Sua sacola está vazia</h2><p>Adicione produtos à sacola antes de finalizar.</p><Link className="primary-button checkout-return" to="/#produtos">Ver coleção</Link></section>
        ) : (
          <>
            {checkout.erro && <p className="checkout-api-error" role="alert">{checkout.erro}</p>}
            <div className="checkout-layout">
              <CheckoutForm bloqueado={cart.ocupado || vazio || cart.dadosDesatualizados} enviando={checkout.enviando} onConfirmar={checkout.confirmar} />
              {cart.carrinho && <CheckoutSummary carrinho={cart.carrinho} />}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

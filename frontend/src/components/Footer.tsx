import { Brand } from './Brand'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner content-width">
        <div className="footer-brand"><Brand /><p className="footer-tagline">Elegância em cada detalhe.</p></div>
        <nav className="footer-navigation" aria-labelledby="footer-navigation-title">
          <h2 id="footer-navigation-title">Navegação</h2>
          <ul>
            <li><Link to="/#inicio">Início</Link></li>
            <li><Link to="/#produtos">Nova coleção</Link></li>
            <li><Link to="/#produtos">Nossas peças</Link></li>
          </ul>
        </nav>
        <section className="footer-about" aria-labelledby="footer-about-title">
          <h2 id="footer-about-title">Sobre o projeto</h2>
          <p>E-commerce fictício desenvolvido para teste e portfólio. Não realiza vendas ou entregas reais.</p>
        </section>
      </div>
      <p className="footer-bottom">© 2026 Alva Modas. Projeto demonstrativo.</p>
    </footer>
  )
}

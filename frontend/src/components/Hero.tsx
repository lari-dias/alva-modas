import { ArrowRight } from 'lucide-react'
import heroImage from '../assets/images/hero-alva.png'
import { Link } from 'react-router-dom'

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-image" src={heroImage} alt="Modelo vestindo blusa vinho da coleção Alva Modas" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-inner content-width">
        <div className="hero-copy">
          <h1 id="hero-title">Nova<br />Coleção</h1>
          <p>Peças atemporais para<br className="desktop-break" /> um estilo moderno e elegante.</p>
          <Link className="primary-button hero-button" to="/#produtos">Comprar agora <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="hero-indicators" aria-hidden="true"><span className="active" /><span /><span /></div>
      </div>
    </section>
  )
}

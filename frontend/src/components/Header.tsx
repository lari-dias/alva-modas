import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { Brand } from './Brand'
import { useCarrinho } from '../hooks/useCarrinho'
import { Link, useLocation } from 'react-router-dom'
import { useCatalogo } from '../hooks/useCatalogo'
import { ProductSearch } from './ProductSearch'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const [menuAbertoEm, setMenuAbertoEm] = useState<string | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const categoriasMenu = useRef<HTMLDetailsElement>(null)
  const buscaButton = useRef<HTMLButtonElement>(null)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const catalogo = useCatalogo()
  const categorias = catalogo.categorias
  const carrinho = useCarrinho()
  const auth = useAuth()
  const { pathname, key } = useLocation()
  const menuAberto = menuAbertoEm === key

  useEffect(() => {
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menuAberto) {
        setMenuAbertoEm(null)
        menuButton.current?.focus()
      }
      if (categoriasMenu.current?.open) {
        categoriasMenu.current.open = false
        categoriasMenu.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('keydown', fecharComEscape)
    return () => document.removeEventListener('keydown', fecharComEscape)
  }, [menuAberto])

  return (
    <header className="site-header">
      <div className="header-inner content-width">
        <button ref={menuButton} type="button" className="icon-button mobile-menu-button" aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuAberto} aria-controls="mobile-navigation" onClick={() => { setBuscaAberta(false); setMenuAbertoEm(menuAberto ? null : key) }}>
          {menuAberto ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <Brand onNavigate={() => setMenuAbertoEm(null)} />
        <nav className="desktop-navigation" aria-label="Navegação principal">
          <Link className={pathname === '/' ? 'navigation-active' : undefined} to="/#inicio" aria-current={pathname === '/' ? 'page' : undefined}>Início</Link>
          <details key={key} ref={categoriasMenu} className="category-menu">
            <summary>Categorias <ChevronDown size={15} aria-hidden="true" /></summary>
            <ul>{categorias.map((categoria) => <li key={categoria}><Link to={catalogo.linkCategoria(categoria)}>{categoria}</Link></li>)}{categorias.length === 0 && <li className="category-unavailable">{catalogo.consulta.isPending ? 'Carregando categorias...' : 'Categorias indisponíveis'}</li>}</ul>
          </details>
          <Link to="/#produtos">Novidades</Link>
          <button type="button" className="navigation-placeholder" disabled title="Promoções disponíveis em breve">Promoções</button>
        </nav>
        <div className="header-actions">
          <button ref={buscaButton} type="button" className="icon-button" aria-label="Buscar produtos" aria-expanded={buscaAberta} aria-controls="product-search" onClick={() => { setMenuAbertoEm(null); if (categoriasMenu.current) categoriasMenu.current.open = false; setBuscaAberta(!buscaAberta) }}><Search aria-hidden="true" /></button>
          <Link to="/conta" className="icon-button account-button" title={auth.cliente ? 'Minha conta' : 'Entrar ou criar conta'} aria-label={auth.cliente ? `Minha conta, ${auth.cliente.nome}` : 'Minha conta'} onClick={() => { setBuscaAberta(false); setMenuAbertoEm(null); auth.limparErro() }}><UserRound aria-hidden="true" /></Link>
          <button type="button" className="icon-button cart-trigger" onClick={() => { setBuscaAberta(false); setMenuAbertoEm(null); carrinho.abrir() }} aria-label={carrinho.quantidade ? `Abrir carrinho, ${carrinho.quantidade} unidades` : 'Abrir carrinho'} aria-haspopup="dialog" aria-expanded={carrinho.aberto} aria-controls="cart-drawer"><ShoppingBag aria-hidden="true" />{carrinho.quantidade > 0 && <span className="cart-badge" aria-hidden="true">{carrinho.quantidade}</span>}</button>
        </div>
      </div>
      {buscaAberta && <ProductSearch key={catalogo.busca} busca={catalogo.busca} onBuscar={(termo) => { catalogo.buscar(termo); setBuscaAberta(false) }} onFechar={() => { setBuscaAberta(false); buscaButton.current?.focus({ preventScroll: true }) }} />}
      {menuAberto && (
        <nav id="mobile-navigation" className="mobile-navigation" aria-label="Navegação mobile">
          <Link to="/#inicio" onClick={() => setMenuAbertoEm(null)}>Início</Link>
          <Link to="/#produtos" onClick={() => setMenuAbertoEm(null)}>Nova coleção</Link>
          <p>Categorias</p>
          <ul>{categorias.map((categoria) => <li key={categoria}><Link to={catalogo.linkCategoria(categoria)} onClick={() => setMenuAbertoEm(null)}>{categoria}</Link></li>)}{categorias.length === 0 && <li className="category-unavailable">{catalogo.consulta.isPending ? 'Carregando categorias...' : 'Categorias indisponíveis'}</li>}</ul>
        </nav>
      )}
    </header>
  )
}

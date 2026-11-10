import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { AuthForm } from '../components/AuthForm'
import { useAuth } from '../hooks/useAuth'
import './auth.css'

export function AccountPage({ cadastro = false }: { cadastro?: boolean }) {
  const auth = useAuth()
  return <div className="storefront"><Header /><main className="auth-page content-width">
    <section className="auth-panel" aria-labelledby="account-title">
      <p className="auth-eyebrow">ALVA MODAS</p>
      <h1 id="account-title" tabIndex={-1}>{auth.cliente ? 'Minha conta' : cadastro ? 'Criar conta' : 'Bem-vinda à Alva'}</h1>
      {auth.carregando ? <p role="status">Conferindo sua sessão...</p> : auth.cliente ? <>
        <p className="auth-greeting">Olá, {auth.cliente.nome}.</p><p className="auth-muted">{auth.cliente.email}</p>
        <Link className="primary-button auth-submit" to="/#produtos">Continuar comprando</Link>
        <button type="button" className="auth-secondary" disabled={auth.ocupado} onClick={() => { void auth.sair().catch(() => undefined) }}>{auth.ocupado ? 'Saindo...' : 'Sair da conta'}</button>
      </> : <>
        <p className="auth-muted">{cadastro ? 'Seus dados de acesso, em um só lugar.' : 'Entre com seu e-mail e senha.'}</p>
        {cadastro ? <AuthForm key="cadastro" cadastro ocupado={auth.ocupado} onEnviar={async (dados) => { await auth.cadastrar(dados).catch(() => undefined) }} /> : <AuthForm key="login" cadastro={false} ocupado={auth.ocupado} onEnviar={async (dados) => { await auth.entrar(dados).catch(() => undefined) }} />}
        <p className="auth-switch">{cadastro ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <Link to={cadastro ? '/conta' : '/cadastro'} onClick={auth.limparErro}>{cadastro ? 'Entrar' : 'Criar conta'}</Link></p>
      </>}
      {auth.erro && <div className="auth-error" role="alert"><p>{auth.erro}</p>{!auth.cliente && <button type="button" onClick={auth.recarregar} disabled={auth.ocupado}>Conferir sessão</button>}</div>}
      <p className="auth-guest">Você também pode comprar como visitante, sem criar uma conta.</p>
      <Link className="auth-back" to="/#produtos">Voltar à coleção</Link>
    </section>
  </main><Footer /></div>
}

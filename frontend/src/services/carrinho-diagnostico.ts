export function diagnosticoCarrinhoAtivo() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('diagnostico-carrinho') === '1'
}

const assinantes = new Set<() => void>()
export function assinarAtivacaoDiagnostico(assinante: () => void) {
  assinantes.add(assinante)
  return () => { assinantes.delete(assinante) }
}
export function sincronizarAtivacaoDiagnostico() {
  if (!diagnosticoCarrinhoAtivo()) registros = []
  assinantes.forEach(assinante => assinante())
}

export type EventoCarrinho = 'toque no botão' | 'handler adicionar' | 'cancelando consultas' | 'consultas canceladas' | 'aguardando lock' | 'lock adquirido' | 'lock liberado' | 'lock falhou' | 'GET iniciado' | 'POST iniciado' | 'PUT iniciado' | 'resposta HTTP' | 'falha de rede ou cancelamento' | 'resposta inválida' | 'mutation concluída' | 'mutation falhou' | 'estado atualizado' | 'erro de execução' | 'promise rejeitada'
type TransicaoCarrinho = `consulta ${'pending' | 'success' | 'error'}` | `rede ${'idle' | 'fetching' | 'paused'}` | `mutation ${'idle' | 'pending' | 'success' | 'error'}` | 'mutation pausada'
type EventoConcorrencia = `${'lock' | 'fila local'}: ${'aguardando' | 'adquirido' | 'executando' | 'execução concluída' | 'execução falhou' | 'liberado' | 'aquisição falhou'}`
export type RegistroCarrinho = { hora: string; evento: EventoCarrinho | TransicaoCarrinho | EventoConcorrencia; status?: number }
let registros: RegistroCarrinho[] = []

export function registrarCarrinho(evento: RegistroCarrinho['evento'], status?: number) {
  if (!diagnosticoCarrinhoAtivo()) return
  registros = [...registros.slice(-59), { hora: new Date().toLocaleTimeString(), evento, ...(status === undefined ? {} : { status }) }]
}

export function lerRegistrosCarrinho() { return registros }

export function presencaArmazenamento() {
  try {
    return {
      acessivel: true,
      cartId: Boolean(localStorage.getItem('alva-modas:cart-id')),
      checkoutPendente: Boolean(localStorage.getItem('alva-modas:checkout-pending')),
    }
  } catch {
    return { acessivel: false, cartId: null, checkoutPendente: null }
  }
}

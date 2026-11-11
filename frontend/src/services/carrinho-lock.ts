import { diagnosticoCarrinhoAtivo, registrarCarrinho } from './carrinho-diagnostico'
let fila: Promise<unknown> = Promise.resolve()

export function serializarCarrinho<T>(operacao: () => Promise<T>): Promise<T> {
  if (diagnosticoCarrinhoAtivo()) {
    const tipo = typeof navigator !== 'undefined' && navigator.locks ? 'lock' : 'fila local'
    let adquirido = false
    registrarCarrinho(`${tipo}: aguardando`)
    const executar = async () => {
      adquirido = true
      registrarCarrinho(`${tipo}: adquirido`)
      registrarCarrinho(`${tipo}: executando`)
      try {
        const valor = await operacao()
        registrarCarrinho(`${tipo}: execução concluída`)
        return valor
      } catch (erro) {
        registrarCarrinho(`${tipo}: execução falhou`)
        throw erro
      }
    }
    let resultado: Promise<T>
    try {
      if (tipo === 'lock') {
        resultado = navigator.locks.request('alva-modas:carrinho', executar)
      } else {
        resultado = fila.then(executar, executar)
        fila = resultado.catch(() => undefined)
      }
    } catch (erro) {
      registrarCarrinho(`${tipo}: aquisição falhou`)
      throw erro
    }
    return resultado.then(valor => {
      registrarCarrinho(`${tipo}: liberado`)
      return valor
    }, erro => {
      registrarCarrinho(adquirido ? `${tipo}: liberado` : `${tipo}: aquisição falhou`)
      throw erro
    })
  }
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('alva-modas:carrinho', operacao)
  }
  const resultado = fila.then(operacao, operacao)
  fila = resultado.catch(() => undefined)
  return resultado
}

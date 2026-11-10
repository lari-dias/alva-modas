let fila: Promise<unknown> = Promise.resolve()

export function serializarCarrinho<T>(operacao: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('alva-modas:carrinho', operacao)
  }
  const resultado = fila.then(operacao, operacao)
  fila = resultado.catch(() => undefined)
  return resultado
}

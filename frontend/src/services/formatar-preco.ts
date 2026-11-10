const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarPreco(preco: string): string {
  return moeda.format(Number(preco))
}

export function formatarCentavos(centavos: number): string {
  return moeda.format(centavos / 100)
}

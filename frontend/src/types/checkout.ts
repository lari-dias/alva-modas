export interface DadosCliente {
  nome: string
  email: string
}

export type EmailStatus = 'ACEITO_PELO_SMTP' | 'FALHOU' | 'DESABILITADO'

export interface ItemPedidoConfirmado {
  produtoId: string
  nomeProduto: string
  quantidade: number
  precoUnitarioCentavos: number
  subtotalCentavos: number
}

export interface PedidoConfirmado {
  idPedido: string
  status: 'CONFIRMADO'
  itens: ItemPedidoConfirmado[]
  totalCentavos: number
  emailStatus: EmailStatus
}


export enum StatusEnvioEmail {
  ACEITO_PELO_SMTP = 'ACEITO_PELO_SMTP',
  ACEITO_PELA_API = 'ACEITO_PELA_API',
  FALHOU = 'FALHOU',
  DESABILITADO = 'DESABILITADO',
}

export interface ItemConfirmado {
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  subtotalCentavos: number;
}

export interface ConfirmacaoPedido {
  idPedido: string;
  nomeCliente: string;
  emailCliente: string;
  itens: ItemConfirmado[];
  totalCentavos: number;
}

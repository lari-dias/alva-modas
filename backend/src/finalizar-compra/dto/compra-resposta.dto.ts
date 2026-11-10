import { ApiProperty } from '@nestjs/swagger';
import { StatusPedido } from '../../pedidos/enums/status-pedido.enum';
import { StatusEnvioEmail } from '../../email/confirmacao-pedido';

export class ItemCompraRespostaDto {
  @ApiProperty({ format: 'uuid' })
  produtoId!: string;

  @ApiProperty()
  nomeProduto!: string;

  @ApiProperty({ type: 'integer' })
  quantidade!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Preço unitário em centavos de real.',
  })
  precoUnitarioCentavos!: number;

  @ApiProperty({ type: 'integer' })
  subtotalCentavos!: number;
}

export class CompraRespostaDto {
  @ApiProperty({ format: 'uuid' })
  idPedido!: string;

  @ApiProperty({ enum: StatusPedido })
  status!: StatusPedido;

  @ApiProperty({ type: [ItemCompraRespostaDto] })
  itens!: ItemCompraRespostaDto[];

  @ApiProperty({ type: 'integer', description: 'Total em centavos de real.' })
  totalCentavos!: number;

  @ApiProperty({
    enum: StatusEnvioEmail,
    description:
      'Aceitação pelo SMTP não garante entrega. Falha ou envio desabilitado não desfazem o pedido.',
  })
  emailStatus!: StatusEnvioEmail;
}

import { ApiProperty } from '@nestjs/swagger';
import { ProdutoRespostaDto } from '../../produtos/dto/produto-resposta.dto';

export class ItemCarrinhoRespostaDto {
  @ApiProperty({
    description:
      'Se o item pode ser comprado na quantidade atual. Itens indisponíveis permanecem visíveis para remoção ou redução; dados de produtos excluídos são os últimos conhecidos.',
  })
  disponivel!: boolean;

  @ApiProperty({ type: ProdutoRespostaDto })
  produto!: ProdutoRespostaDto;

  @ApiProperty({ type: 'integer', example: 2 })
  quantidade!: number;

  @ApiProperty({
    type: 'integer',
    example: 9990,
    description: 'Preço atual em centavos de real.',
  })
  precoUnitarioCentavos!: number;

  @ApiProperty({ type: 'integer', example: 19980 })
  subtotalCentavos!: number;
}

export class CarrinhoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  idCarrinho!: string;

  @ApiProperty({ type: [ItemCarrinhoRespostaDto] })
  itens!: ItemCarrinhoRespostaDto[];

  @ApiProperty({
    type: 'integer',
    example: 19980,
    description: 'Total em centavos de real.',
  })
  totalCentavos!: number;
}

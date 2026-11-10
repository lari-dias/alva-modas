import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { LIMITES_CARRINHO } from '../carrinho.constants';

export class AdicionarItemDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID de um produto ativo do catálogo.',
  })
  @IsUUID('4')
  produtoId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: LIMITES_CARRINHO.unidadesPorItem,
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(LIMITES_CARRINHO.unidadesPorItem)
  quantidade!: number;
}

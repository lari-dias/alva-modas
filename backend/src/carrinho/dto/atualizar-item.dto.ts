import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { LIMITES_CARRINHO } from '../carrinho.constants';

export class AtualizarItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  produtoId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: LIMITES_CARRINHO.unidadesPorItem,
    example: 2,
    description: 'Nova quantidade absoluta. Zero remove o produto.',
  })
  @IsInt()
  @Min(0)
  @Max(LIMITES_CARRINHO.unidadesPorItem)
  quantidade!: number;
}

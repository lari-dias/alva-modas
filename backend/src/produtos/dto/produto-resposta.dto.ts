import { ApiProperty } from '@nestjs/swagger';

export class ProdutoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Vestido Floral Aurora' })
  nome!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Vestido floral para o dia a dia.',
  })
  descricao!: string | null;

  @ApiProperty({
    type: String,
    example: '189.90',
    description: 'Valor em reais como string decimal, preservando a precisão.',
  })
  preco!: string;

  @ApiProperty({
    format: 'uri',
    example:
      'https://images.pexels.com/photos/12458678/pexels-photo-12458678.jpeg?auto=compress&cs=tinysrgb&w=800',
  })
  imagemUrl!: string;

  @ApiProperty({ example: 'Vestidos' })
  categoria!: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 15 })
  estoque!: number;
}

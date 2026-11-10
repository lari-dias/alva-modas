import { ApiProperty } from '@nestjs/swagger';

export class ClienteRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ format: 'email' })
  email: string;
}

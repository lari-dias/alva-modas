import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class FinalizarCompraDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Maria Silva' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  nome!: string;

  @ApiProperty({
    format: 'email',
    maxLength: 254,
    example: 'cliente@example.test',
  })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

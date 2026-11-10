import { UnprocessableEntityException } from '@nestjs/common';

export function paraDecimal(centavos: number): string {
  if (
    !Number.isSafeInteger(centavos) ||
    centavos < 0 ||
    centavos > 9999999999
  ) {
    throw new UnprocessableEntityException(
      'Valor da compra excede o limite permitido.',
    );
  }
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

import { InternalServerErrorException } from '@nestjs/common';

export function paraCentavos(valor: string): number {
  if (!/^\d{1,8}\.\d{2}$/.test(valor)) {
    throw new InternalServerErrorException('Preço do produto indisponível.');
  }
  const [reais, centavos] = valor.split('.');
  return Number(reais) * 100 + Number(centavos);
}

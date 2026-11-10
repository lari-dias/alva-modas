import { paraCentavos } from './centavos';

describe('paraCentavos', () => {
  it.each([
    ['0.00', 0],
    ['0.10', 10],
    ['19.99', 1999],
    ['99999999.99', 9999999999],
  ])('converts %s without fractional arithmetic', (value, expected) => {
    expect(paraCentavos(value)).toBe(expected);
  });
  it.each(['NaN', '-1.00', '1.999', 'Infinity', '100000000.00'])(
    'rejects invalid database price %s',
    (value) => {
      expect(() => paraCentavos(value)).toThrow(
        'Preço do produto indisponível.',
      );
    },
  );
});

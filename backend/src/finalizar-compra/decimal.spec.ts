import { paraDecimal } from './decimal';

describe('paraDecimal', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [10, '0.10'],
    [2999, '29.99'],
    [9999999999, '99999999.99'],
  ])('converts %s cents exactly', (centavos, esperado) => {
    expect(paraDecimal(centavos)).toBe(esperado);
  });
  it.each([-1, 0.1, Number.NaN, 10000000000])(
    'rejects an invalid or overflowing total %s',
    (centavos) => {
      expect(() => paraDecimal(centavos)).toThrow();
    },
  );
});

import { validateEnvironment } from './environment';

const database = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'test',
};

describe('SMTP environment validation', () => {
  it('defaults to disabled SMTP on loopback without credentials', () => {
    expect(validateEnvironment(database)).toMatchObject({
      SMTP_ENABLED: false,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
    });
  });
  it('parses booleans and ports explicitly', () => {
    expect(
      validateEnvironment({
        ...database,
        SMTP_ENABLED: 'true',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
      }),
    ).toMatchObject({ SMTP_ENABLED: true, SMTP_PORT: 465, SMTP_SECURE: true });
    expect(
      validateEnvironment({ ...database, SMTP_ENABLED: 'false' }).SMTP_ENABLED,
    ).toBe(false);
  });
  it('rejects invalid configuration without exposing credentials', () => {
    expect(() =>
      validateEnvironment({ ...database, SMTP_ENABLED: 'yes' }),
    ).toThrow('SMTP_ENABLED');
    expect(() =>
      validateEnvironment({ ...database, SMTP_USER: 'test' }),
    ).toThrow('configured together');
    expect(() =>
      validateEnvironment({ ...database, SMTP_PORT: 'invalid' }),
    ).toThrow('SMTP_PORT');
    expect(() =>
      validateEnvironment({ ...database, SMTP_FROM: 'invalid' }),
    ).toThrow('SMTP_FROM');
  });
});

describe('Production environment validation', () => {
  const production = {
    ...database,
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://www.loja-alva.test',
    DB_SSL: 'true',
    TRUST_PROXY_HOPS: '1',
  };

  it('requires HTTPS origins and database TLS in production', () => {
    expect(validateEnvironment(production)).toMatchObject({
      NODE_ENV: 'production',
      DB_SSL: true,
      TRUST_PROXY_HOPS: 1,
    });
    expect(() =>
      validateEnvironment({
        ...production,
        FRONTEND_URL: 'http://www.loja-alva.test',
      }),
    ).toThrow('HTTPS');
    expect(() =>
      validateEnvironment({ ...production, DB_SSL: 'false' }),
    ).toThrow('DB_SSL');
  });

  it.each([
    '*',
    'https://*.loja-alva.test',
    'https://www.loja-alva.test/checkout',
  ])('rejects an invalid CORS origin: %s', (origin) => {
    expect(() =>
      validateEnvironment({ ...production, FRONTEND_URL: origin }),
    ).toThrow();
  });

  it('requires TLS for authenticated production SMTP', () => {
    const smtp = {
      ...production,
      SMTP_ENABLED: 'true',
      SMTP_USER: 'test-user',
      SMTP_PASSWORD: 'test-password',
    };
    expect(() => validateEnvironment(smtp)).toThrow('requires TLS');
    expect(
      validateEnvironment({ ...smtp, SMTP_REQUIRE_TLS: 'true' }),
    ).toMatchObject({ SMTP_REQUIRE_TLS: true });
    expect(validateEnvironment({ ...smtp, SMTP_SECURE: 'true' })).toMatchObject(
      { SMTP_SECURE: true },
    );
  });

  it('allows a private unauthenticated capture server with explicit configuration', () => {
    expect(
      validateEnvironment({
        ...production,
        SMTP_ENABLED: 'true',
        SMTP_REQUIRE_TLS: 'false',
      }),
    ).toMatchObject({ SMTP_REQUIRE_TLS: false });
  });

  it.each(['invalid', '-1', '1.5', '6'])(
    'rejects invalid proxy hops: %s',
    (value) => {
      expect(() =>
        validateEnvironment({ ...production, TRUST_PROXY_HOPS: value }),
      ).toThrow('TRUST_PROXY_HOPS');
    },
  );
});

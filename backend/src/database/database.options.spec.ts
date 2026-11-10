import { databaseOptions } from './database.options';

const config = {
  DB_HOST: 'db.test',
  DB_USERNAME: 'app',
  DB_PASSWORD: 'test-only',
  DB_DATABASE: 'alva',
};

describe('Database configuration', () => {
  const environment = {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'password',
    DB_DATABASE: 'alva_modas',
  };

  it('uses PostgreSQL without automatic schema changes', () => {
    expect(databaseOptions(environment)).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      synchronize: false,
      migrationsRun: false,
    });
  });

  it('rejects missing credentials and invalid ports', () => {
    expect(() => databaseOptions({ ...environment, DB_PASSWORD: '' })).toThrow(
      'DB_PASSWORD',
    );
    expect(() =>
      databaseOptions({ ...environment, DB_PORT: 'invalid' }),
    ).toThrow('DB_PORT');
  });
});

describe('PostgreSQL transport configuration', () => {
  it('preserves local development without SSL or automatic schema changes', () => {
    expect(databaseOptions(config)).toMatchObject({
      ssl: false,
      synchronize: false,
      migrationsRun: false,
    });
  });

  it('enables certificate verification with the default CA trust store', () => {
    expect(databaseOptions({ ...config, DB_SSL: 'true' })).toMatchObject({
      ssl: { rejectUnauthorized: true },
    });
  });

  it('supports a provider CA without disabling certificate verification', () => {
    expect(
      databaseOptions({
        ...config,
        DB_SSL: 'true',
        DB_SSL_CA: 'BEGIN\\nCA\\nEND',
      }),
    ).toMatchObject({
      ssl: { rejectUnauthorized: true, ca: 'BEGIN\nCA\nEND' },
    });
  });
});

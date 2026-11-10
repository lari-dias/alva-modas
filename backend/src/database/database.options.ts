import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { validateEnvironment } from '../config/environment';

export function databaseOptions(
  config: Record<string, unknown>,
): DataSourceOptions {
  const env = validateEnvironment(config);
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    ssl: env.DB_SSL
      ? {
          rejectUnauthorized: true,
          ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
        }
      : false,
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    synchronize: false,
    migrationsRun: false,
  };
}

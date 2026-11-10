
import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsIn,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL = 'http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE!: string;

  @IsBoolean()
  DB_SSL = false;

  @IsString()
  DB_SSL_CA = '';

  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS = 0;

  @IsBoolean()
  SMTP_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  SMTP_HOST = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT = 1025;

  @IsBoolean()
  SMTP_SECURE = false;

  @IsBoolean()
  SMTP_REQUIRE_TLS = false;

  @IsString()
  SMTP_USER = '';

  @IsString()
  SMTP_PASSWORD = '';

  @IsEmail()
  SMTP_FROM = 'pedidos@alvamodas.test';

  @IsString()
  RESEND_API_KEY = '';

  @IsString()
  @IsNotEmpty()
  RESEND_FROM = 'Alva Modas <onboarding@resend.dev>';
}

function booleanEnvironment(value: unknown, key: string): boolean {
  if (value === undefined || value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  throw new Error(`Invalid environment variable: ${key}`);
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(Environment, {
    ...config,
    PORT: Number(config.PORT ?? 3000),
    DB_PORT: Number(config.DB_PORT ?? 5432),
    SMTP_PORT: Number(config.SMTP_PORT ?? 1025),
    SMTP_ENABLED: booleanEnvironment(config.SMTP_ENABLED, 'SMTP_ENABLED'),
    SMTP_SECURE: booleanEnvironment(config.SMTP_SECURE, 'SMTP_SECURE'),
    SMTP_REQUIRE_TLS: booleanEnvironment(
      config.SMTP_REQUIRE_TLS,
      'SMTP_REQUIRE_TLS',
    ),
    DB_SSL: booleanEnvironment(config.DB_SSL, 'DB_SSL'),
    TRUST_PROXY_HOPS: Number(config.TRUST_PROXY_HOPS ?? 0),
  });

  if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }

  const errors = validateSync(environment);

  if (errors.length) {
    throw new Error(
      `Invalid environment variables: ${errors.map((error) => error.property).join(', ')}`,
    );
  }

  const origins = environment.FRONTEND_URL.split(',').map((origin) =>
    origin.trim(),
  );

  for (const origin of origins) {
    const url = new URL(origin);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.hostname.includes('*')
    ) {
      throw new Error(
        'FRONTEND_URL must contain HTTP origins separated by commas',
      );
    }
  }

  if (environment.NODE_ENV === 'production') {
    if (!origins.every((origin) => new URL(origin).protocol === 'https:')) {
      throw new Error('FRONTEND_URL must use HTTPS in production');
    }

    if (!environment.DB_SSL) {
      throw new Error('DB_SSL must be true in production');
    }

    if (
      environment.SMTP_ENABLED &&
      environment.SMTP_USER &&
      !environment.SMTP_SECURE &&
      !environment.SMTP_REQUIRE_TLS
    ) {
      throw new Error('Authenticated SMTP requires TLS in production');
    }

    if (!environment.RESEND_API_KEY && !environment.SMTP_ENABLED) {
      throw new Error(
        'Configure RESEND_API_KEY ou habilite SMTP em produção',
      );
    }
  }

  return environment;
}

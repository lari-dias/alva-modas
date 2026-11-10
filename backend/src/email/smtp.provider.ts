import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export const SMTP_TRANSPORT = Symbol('SMTP_TRANSPORT');
export type SmtpTransport = Transporter<SMTPTransport.SentMessageInfo>;

export const smtpProvider = {
  provide: SMTP_TRANSPORT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): SmtpTransport | null => {
    if (!config.get<boolean>('SMTP_ENABLED', false)) return null;
    const user = config.get<string>('SMTP_USER', '');
    return createTransport({
      host: config.get<string>('SMTP_HOST', '127.0.0.1'),
      port: config.get<number>('SMTP_PORT', 1025),
      secure: config.get<boolean>('SMTP_SECURE', false),
      requireTLS: config.get<boolean>('SMTP_REQUIRE_TLS', false),
      auth: user
        ? { user, pass: config.getOrThrow<string>('SMTP_PASSWORD') }
        : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  },
};

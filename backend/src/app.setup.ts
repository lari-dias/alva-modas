import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS', 0));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    credentials: true,
    origin: config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')
      .map((origin) => origin.trim()),
  });
  const document = new DocumentBuilder()
    .setTitle('Alva Modas API')
    .setDescription('API do e-commerce Alva Modas')
    .setVersion('1.0')
    .addCookieAuth('alva_session')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, document),
  );
}

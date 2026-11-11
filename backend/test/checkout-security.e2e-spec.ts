import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AuthRateLimitGuard } from '../src/auth/auth-rate-limit.guard';
import { CheckoutDeploymentController } from '../src/finalizar-compra/checkout-deployment.controller';
import { CheckoutDeploymentService } from '../src/finalizar-compra/checkout-deployment.service';

describe('Proxy, cookies, CSRF e controle operacional', () => {
  let app: INestApplication<App>;
  const origin = 'https://loja.example.test';
  const secret = 'proxy-test-secret-at-least-32-characters';
  const admin = 'admin-test-secret-at-least-32-characters';
  const entrar = jest
    .fn()
    .mockResolvedValue({ token: 'session-test', cliente: { id: 'cliente' } });
  const deployment = {
    status: jest.fn().mockResolvedValue({
      aberto: false,
      drenado: true,
      legado_retirado: false,
    }),
    pausar: jest.fn().mockResolvedValue({ aberto: false, drenado: true }),
    abrir: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              NODE_ENV: 'production',
              FRONTEND_URL: origin,
              API_PROXY_SECRET: secret,
              CHECKOUT_ADMIN_TOKEN: admin,
              JWT_COOKIE_SECURE: 'true',
              JWT_COOKIE_PATH: '/api/auth',
            }),
          ],
        }),
      ],
      controllers: [AuthController, CheckoutDeploymentController],
      providers: [
        { provide: AuthService, useValue: { entrar } },
        AuthRateLimitGuard,
        { provide: CheckoutDeploymentService, useValue: deployment },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emite cookie first-party forte com o Path externo correto', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Alva-Proxy-Secret', secret)
      .send({ email: 'cliente@example.test', senha: 'senha-segura-123' })
      .expect(200);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('Domain=');
  });

  it('não permite acesso direto ao backend nem CSRF por origem forjada', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Alva-Proxy-Secret', secret)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Alva-Proxy-Secret', secret)
      .set('Origin', 'https://attacker.example')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({})
      .expect(403);
    expect(entrar).not.toHaveBeenCalled();
  });

  it('não permite operações administrativas por sessão ou segredo do proxy', async () => {
    await request(app.getHttpServer())
      .post('/internal/checkout/pause')
      .set('Cookie', 'alva_session=session')
      .set('X-Alva-Proxy-Secret', secret)
      .send({})
      .expect(401);
    expect(deployment.pausar).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/internal/checkout/pause')
      .set('Authorization', `Bearer ${admin}`)
      .send({})
      .expect(201);
    expect(deployment.pausar).toHaveBeenCalledTimes(1);
  });

  it('status público não expõe detalhes operacionais', async () => {
    const response = await request(app.getHttpServer())
      .get('/checkout/status')
      .set('X-Alva-Proxy-Secret', secret)
      .expect(200);
    expect(response.body).toEqual({ aberto: false });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rate limit mantém clientes distintos e não confia em IP sem proxy autenticado', async () => {
    const server = app.getHttpServer();
    for (let index = 0; index < 20; index++)
      await request(server)
        .post('/auth/login')
        .set('Origin', origin)
        .set('X-Alva-Proxy-Secret', secret)
        .set('X-Alva-Client-Ip', '198.51.100.10')
        .send({ email: 'cliente@example.test', senha: 'senha-segura-123' })
        .expect(200);
    await request(server)
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Alva-Proxy-Secret', secret)
      .set('X-Alva-Client-Ip', '198.51.100.10')
      .send({ email: 'cliente@example.test', senha: 'senha-segura-123' })
      .expect(429);
    await request(server)
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Alva-Proxy-Secret', secret)
      .set('X-Alva-Client-Ip', '198.51.100.11')
      .send({ email: 'cliente@example.test', senha: 'senha-segura-123' })
      .expect(200);
    await request(server)
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Alva-Client-Ip', '198.51.100.12')
      .send({})
      .expect(403);
  });
});

import {
  INestApplication,
  UnauthorizedException,
  GoneException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { FinalizarCompraController } from '../src/finalizar-compra/finalizar-compra.controller';
import { FinalizarCompraService } from '../src/finalizar-compra/finalizar-compra.service';
import { CheckoutTentativasController } from '../src/finalizar-compra/checkout-tentativas.controller';
import { CheckoutTentativasService } from '../src/finalizar-compra/checkout-tentativas.service';
import { AuthService } from '../src/auth/auth.service';
import { CheckoutDeploymentService } from '../src/finalizar-compra/checkout-deployment.service';

describe('Checkout HTTP API', () => {
  let app: INestApplication<App>;
  const id = 'a17a0000-0000-4000-8000-000000000088';
  const cartId = 'a17a0000-0000-4000-8000-000000000001';
  const token = 'a'.repeat(64);
  const cliente = { nome: 'Maria Silva', email: 'cliente@example.test' };
  const tentativas = {
    preparar: jest.fn(),
    confirmar: jest.fn(),
    consultar: jest.fn(),
  };
  const finalizar = jest.fn();
  const autenticar = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => ({ FRONTEND_URL: 'http://localhost:5173' })],
        }),
      ],
      controllers: [FinalizarCompraController, CheckoutTentativasController],
      providers: [
        { provide: FinalizarCompraService, useValue: { finalizar } },
        {
          provide: CheckoutDeploymentService,
          useValue: { legado: () => Promise.reject(new GoneException()) },
        },
        { provide: CheckoutTentativasService, useValue: tentativas },
        { provide: AuthService, useValue: { autenticar } },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    tentativas.preparar.mockResolvedValue({ id, estado: 'PROCESSANDO' });
    tentativas.consultar.mockResolvedValue({
      estado: 'PROCESSANDO',
      pedido: null,
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('desativa o endpoint antigo sem criar pedido', async () => {
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(410);
    expect(finalizar).not.toHaveBeenCalled();
  });
  it('prepara visitante com token seguro, sem cache', async () => {
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/' + id)
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .send(cliente)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(tentativas.preparar).toHaveBeenCalledWith(id, cartId, cliente, {
      clienteId: null,
      token,
    });
  });
  it('utiliza o titular da sessão validada no servidor', async () => {
    autenticar.mockResolvedValue({ id: 'cliente-autenticado' });
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/' + id)
      .set('Cookie', 'alva_session=sessao')
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .send(cliente)
      .expect(201);
    expect(autenticar).toHaveBeenCalledWith('sessao');
    expect(tentativas.preparar).toHaveBeenCalledWith(id, cartId, cliente, {
      clienteId: 'cliente-autenticado',
      token,
    });
  });
  it('não converte sessão inválida silenciosamente em visitante', async () => {
    autenticar.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/' + id + '/verificar')
      .set('Cookie', 'alva_session=expirada')
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .expect(401);
    expect(tentativas.consultar).not.toHaveBeenCalled();
  });
  it('exige sessão quando o navegador iniciou checkout autenticado', async () => {
    autenticar.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/' + id + '/verificar')
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .set('X-Checkout-Authenticated', 'true')
      .expect(401);
    expect(autenticar).toHaveBeenCalledWith(undefined);
    expect(tentativas.consultar).not.toHaveBeenCalled();
  });

  it.each(['', 'uuid-conhecido'])(
    'rejeita recuperação sem segredo forte: %s',
    async (valor) => {
      await request(app.getHttpServer())
        .post('/auth/checkout/tentativas/' + id + '/verificar')
        .set('X-Cart-Id', cartId)
        .set('X-Checkout-Token', valor)
        .expect(400);
      expect(tentativas.consultar).not.toHaveBeenCalled();
    },
  );
  it('rejeita dados de preço ou identidade injetados pelo cliente', async () => {
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/' + id)
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .send({ ...cliente, preco: 1, clienteId: id })
      .expect(400);
    expect(tentativas.preparar).not.toHaveBeenCalled();
  });
  it('valida UUIDs antes de acessar a persistência', async () => {
    await request(app.getHttpServer())
      .post('/auth/checkout/tentativas/invalido/verificar')
      .set('X-Cart-Id', cartId)
      .set('X-Checkout-Token', token)
      .expect(400);
    expect(tentativas.consultar).not.toHaveBeenCalled();
  });
});

import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { CarrinhoService } from '../src/carrinho/carrinho.service';
import { Produto } from '../src/produtos/entities/produto.entity';
import { FinalizarCompraModule } from '../src/finalizar-compra/finalizar-compra.module';
import { CompraRespostaDto } from '../src/finalizar-compra/dto/compra-resposta.dto';
import { EmailService } from '../src/email/email.service';
import { StatusEnvioEmail } from '../src/email/confirmacao-pedido';
import {
  CheckoutDatabase,
  PRODUTO_TESTE_ID,
} from './support/checkout-database';

const db = new CheckoutDatabase();

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: db }],
  exports: [DataSource],
})
class TestDatabaseModule {}

describe('Checkout HTTP API', () => {
  let app: INestApplication<App>;
  let cartId: string;
  const email = { enviarConfirmacao: jest.fn() };
  const cliente = { nome: 'Maria Silva', email: 'cliente@example.test' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              FRONTEND_URL: 'http://localhost:5173',
              SMTP_ENABLED: false,
            }),
          ],
        }),
        TestDatabaseModule,
        FinalizarCompraModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Produto))
      .useValue({ find: () => Promise.resolve(db.produtos) })
      .overrideProvider(EmailService)
      .useValue(email)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(async () => {
    db.reset();
    email.enviarConfirmacao
      .mockReset()
      .mockResolvedValue(StatusEnvioEmail.DESABILITADO);
    const carrinhos = app.get(CarrinhoService);
    carrinhos.onModuleDestroy();
    cartId = (
      await carrinhos.adicionar({ produtoId: PRODUTO_TESTE_ID, quantidade: 2 })
    ).idCarrinho;
  });
  afterAll(async () => {
    await app.close();
  });

  it('confirms a purchase without accepting client prices and prevents a second checkout', async () => {
    const response = await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(201);
    const pedido = response.body as CompraRespostaDto;
    expect(pedido).toMatchObject({
      status: 'CONFIRMADO',
      totalCentavos: 3980,
      emailStatus: 'DESABILITADO',
    });
    expect(Object.keys(pedido).sort()).toEqual(
      ['idPedido', 'status', 'itens', 'totalCentavos', 'emailStatus'].sort(),
    );
    expect(db.produtos[0].estoque).toBe(8);
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(404);
  });

  it.each([
    { nome: '', email: 'cliente@example.test' },
    { nome: ' ', email: 'cliente@example.test' },
    { nome: 123, email: 'cliente@example.test' },
    { nome: 'Maria', email: 'invalid' },
    { nome: 'Maria' },
    { email: 'cliente@example.test' },
    { ...cliente, preco: '0.01' },
    { ...cliente, total: 1 },
  ])('rejects invalid customer data and unknown fields: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(body)
      .expect(400);
    expect(db.pedidos).toHaveLength(0);
  });

  it('requires a valid cart UUID header', async () => {
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .send(cliente)
      .expect(400);
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', 'invalid')
      .send(cliente)
      .expect(400);
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', PRODUTO_TESTE_ID)
      .send(cliente)
      .expect(404);
  });

  it('rejects an empty cart and unavailable stock', async () => {
    db.produtos[0].estoque = 1;
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(409);
    await app
      .get(CarrinhoService)
      .atualizar({ produtoId: PRODUTO_TESTE_ID, quantidade: 0 }, cartId);
    await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(400);
  });

  it('preserves the confirmed order when email sending fails', async () => {
    email.enviarConfirmacao.mockResolvedValue(StatusEnvioEmail.FALHOU);
    const response = await request(app.getHttpServer())
      .post('/finalizar-compra')
      .set('X-Cart-Id', cartId)
      .send(cliente)
      .expect(201);
    expect((response.body as CompraRespostaDto).emailStatus).toBe('FALHOU');
    expect(db.pedidos).toHaveLength(1);
  });

  it('documents header, customer data and confirmation response in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const document = response.body as {
      paths: Record<
        string,
        {
          post: {
            parameters: Array<{ name: string; required: boolean }>;
            requestBody: unknown;
            responses: Record<string, unknown>;
          };
        }
      >;
    };
    const endpoint = document.paths['/finalizar-compra'].post;
    expect(endpoint.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'X-Cart-Id', required: true }),
      ]),
    );
    expect(endpoint.requestBody).toBeDefined();
    expect(endpoint.responses['201']).toBeDefined();
  });
});

import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { CarrinhoModule } from '../src/carrinho/carrinho.module';
import { CarrinhoService } from '../src/carrinho/carrinho.service';
import { CarrinhoRespostaDto } from '../src/carrinho/dto/carrinho-resposta.dto';
import { Produto } from '../src/produtos/entities/produto.entity';
import { CarrinhoCheckoutService } from '../src/carrinho/carrinho-checkout.service';

describe('Cart HTTP API', () => {
  let app: INestApplication<App>;
  const produtoId = 'a17a0000-0000-4000-8000-000000000001';
  let produto: Partial<Produto>;
  const repository = { find: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => ({ FRONTEND_URL: 'http://localhost:5173' })],
        }),
        CarrinhoModule,
      ],
    })
      .overrideProvider(CarrinhoCheckoutService)
      .useValue({
        executar: (_id: string | undefined, operacao: () => Promise<unknown>) =>
          operacao(),
      })
      .overrideProvider(getRepositoryToken(Produto))
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    app.get(CarrinhoService).onModuleDestroy();
    produto = {
      id: produtoId,
      nome: 'Blusa',
      descricao: null,
      preco: '10.10',
      imagemUrl: 'https://example.com/blusa.jpg',
      categoria: 'Blusas',
      estoque: 5,
      ativo: true,
    };
    repository.find
      .mockReset()
      .mockImplementation(() => Promise.resolve([produto]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, increments, reads, updates and removes an item using the server-generated ID', async () => {
    const created = await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId, quantidade: 2 })
      .expect(201);
    const cart = created.body as CarrinhoRespostaDto;
    expect(cart.totalCentavos).toBe(2020);
    const incremented = await request(app.getHttpServer())
      .post('/carrinho')
      .set('X-Cart-Id', cart.idCarrinho)
      .send({ produtoId, quantidade: 1 })
      .expect(201);
    expect((incremented.body as CarrinhoRespostaDto).itens).toHaveLength(1);
    expect((incremented.body as CarrinhoRespostaDto).totalCentavos).toBe(3030);
    produto.preco = '20.20';
    const current = await request(app.getHttpServer())
      .get('/carrinho')
      .set('X-Cart-Id', cart.idCarrinho)
      .expect(200);
    expect((current.body as CarrinhoRespostaDto).totalCentavos).toBe(6060);
    const updated = await request(app.getHttpServer())
      .put('/carrinho')
      .set('X-Cart-Id', cart.idCarrinho)
      .send({ produtoId, quantidade: 1 })
      .expect(200);
    expect((updated.body as CarrinhoRespostaDto).totalCentavos).toBe(2020);
    await request(app.getHttpServer())
      .put('/carrinho')
      .set('X-Cart-Id', cart.idCarrinho)
      .send({ produtoId, quantidade: 0 })
      .expect(200)
      .expect({ idCarrinho: cart.idCarrinho, itens: [], totalCentavos: 0 });
    expect(produto.estoque).toBe(5);
  });

  it.each([-1, 0, 1.5, 101, '2', null])(
    'rejects invalid POST quantity %s',
    async (quantidade) => {
      await request(app.getHttpServer())
        .post('/carrinho')
        .send({ produtoId, quantidade })
        .expect(400);
      expect(repository.find).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 1.5, 101, '2', null])(
    'rejects invalid PUT quantity %s',
    async (quantidade) => {
      const created = await request(app.getHttpServer())
        .post('/carrinho')
        .send({ produtoId, quantidade: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .put('/carrinho')
        .set('X-Cart-Id', (created.body as CarrinhoRespostaDto).idCarrinho)
        .send({ produtoId, quantidade })
        .expect(400);
    },
  );

  it('requires a UUID header for GET and PUT and rejects client-selected unknown carts', async () => {
    await request(app.getHttpServer()).get('/carrinho').expect(400);
    await request(app.getHttpServer())
      .put('/carrinho')
      .send({ produtoId, quantidade: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/carrinho')
      .set('X-Cart-Id', 'invalid')
      .send({ produtoId, quantidade: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .get('/carrinho')
      .set('X-Cart-Id', produtoId)
      .expect(404);
    await request(app.getHttpServer())
      .post('/carrinho')
      .set('X-Cart-Id', produtoId)
      .send({ produtoId, quantidade: 1 })
      .expect(404);
  });

  it('rejects client prices, missing fields and invalid product UUIDs', async () => {
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId, quantidade: 1, preco: '0.01' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId: 'invalid', quantidade: 1 })
      .expect(400);
  });

  it('returns appropriate errors for nonexistent, inactive and out-of-stock products', async () => {
    repository.find.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId, quantidade: 1 })
      .expect(404);
    produto.ativo = false;
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId, quantidade: 1 })
      .expect(409);
    produto.ativo = true;
    produto.estoque = 0;
    await request(app.getHttpServer())
      .post('/carrinho')
      .send({ produtoId, quantidade: 1 })
      .expect(409);
  });

  it('permits X-Cart-Id and JSON in frontend preflight requests', async () => {
    const response = await request(app.getHttpServer())
      .options('/carrinho')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type,x-cart-id')
      .expect(204);
    expect(response.headers['access-control-allow-headers']).toBe(
      'content-type,x-cart-id',
    );
  });
});

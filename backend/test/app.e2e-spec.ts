import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { ProdutosModule } from '../src/produtos/produtos.module';
import { CarrinhoModule } from '../src/carrinho/carrinho.module';
import { PedidosModule } from '../src/pedidos/pedidos.module';
import { EmailModule } from '../src/email/email.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Produto } from '../src/produtos/entities/produto.entity';
import { Pedido } from '../src/pedidos/entities/pedido.entity';
import { ItemPedido } from '../src/pedidos/entities/item-pedido.entity';
import { FindManyOptions } from 'typeorm';

describe('Application setup (e2e)', () => {
  let app: INestApplication<App>;
  const produtos = [
    {
      id: 'a17a0000-0000-4000-8000-000000000001',
      nome: 'Vestido Floral',
      descricao: null,
      preco: '189.90',
      imagemUrl: 'https://example.com/vestido.jpg',
      categoria: 'Vestidos',
      estoque: 0,
      ativo: true,
    },
    {
      id: 'a17a0000-0000-4000-8000-000000000002',
      nome: 'Blusa Branca',
      descricao: 'Blusa branca',
      preco: '99.90',
      imagemUrl: 'https://example.com/blusa.jpg',
      categoria: 'Blusas',
      estoque: 10,
      ativo: true,
    },
    {
      id: 'a17a0000-0000-4000-8000-000000000003',
      nome: 'Calça Inativa',
      descricao: null,
      preco: '149.90',
      imagemUrl: 'https://example.com/calca.jpg',
      categoria: 'Calças',
      estoque: 5,
      ativo: false,
    },
  ];
  const repository = { find: jest.fn() };

  beforeEach(() => {
    repository.find
      .mockReset()
      .mockImplementation((options: FindManyOptions<Produto>) => {
        const where = options.where as { ativo?: boolean };
        const result = produtos.filter(
          (produto) => produto.ativo === where.ativo,
        );
        if (options.order?.nome === 'ASC')
          result.sort((a, b) => a.nome.localeCompare(b.nome));
        return Promise.resolve(result);
      });
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => ({ FRONTEND_URL: 'http://localhost:5173' })],
        }),
        ProdutosModule,
        CarrinhoModule,
        PedidosModule,
        EmailModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Produto))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(Pedido))
      .useValue({})
      .overrideProvider(getRepositoryToken(ItemPedido))
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('documents catalog and cart endpoints in Swagger', async () => {
    await request(app.getHttpServer()).get('/api/docs/').expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = (
      response.body as { paths: Record<string, Record<string, unknown>> }
    ).paths;
    expect(Object.keys(paths).sort()).toEqual(['/carrinho', '/produtos']);
    expect(Object.keys(paths['/produtos'])).toEqual(['get']);
    expect(Object.keys(paths['/carrinho']).sort()).toEqual([
      'get',
      'post',
      'put',
    ]);
    await request(app.getHttpServer()).get('/').expect(404);
  });
  it('returns active products ordered by name with exactly the public fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/produtos')
      .expect(200);
    const body = response.body as Array<Record<string, unknown>>;
    expect(body.map((produto) => produto.nome)).toEqual([
      'Blusa Branca',
      'Vestido Floral',
    ]);
    expect(body[1]).toMatchObject({
      preco: '189.90',
      estoque: 0,
      descricao: null,
    });
    for (const produto of body) {
      expect(Object.keys(produto).sort()).toEqual(
        [
          'id',
          'nome',
          'descricao',
          'preco',
          'imagemUrl',
          'categoria',
          'estoque',
        ].sort(),
      );
    }
  });
  it('returns an empty array when there are no active products', async () => {
    repository.find.mockResolvedValueOnce([]);
    await request(app.getHttpServer()).get('/produtos').expect(200).expect([]);
  });
  it('allows the configured frontend origin', async () => {
    await request(app.getHttpServer())
      .options('/produtos')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173');
  });
  it('does not allow an unconfigured origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/produtos')
      .set('Origin', 'http://example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

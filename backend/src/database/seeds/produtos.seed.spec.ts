import { DataSource, InsertQueryBuilder, InsertResult } from 'typeorm';
import { Produto } from '../../produtos/entities/produto.entity';
import { PRODUTOS_SEED } from './produtos.data';
import { seedProdutos } from './produtos.seed';

class SeedDataSource extends DataSource {
  async buildEntityMetadata() {
    await this.buildMetadatas();
  }
}

describe('Product seed', () => {
  afterEach(() => jest.restoreAllMocks());

  it('contains 12 unique products with positive stock and decimal prices in four categories', () => {
    expect(PRODUTOS_SEED).toHaveLength(12);
    expect(new Set(PRODUTOS_SEED.map((produto) => produto.id)).size).toBe(12);
    expect(new Set(PRODUTOS_SEED.map((produto) => produto.nome)).size).toBe(12);
    for (const categoria of ['Vestidos', 'Blusas', 'Calças', 'Conjuntos']) {
      expect(
        PRODUTOS_SEED.filter((produto) => produto.categoria === categoria),
      ).toHaveLength(3);
    }
    for (const produto of PRODUTOS_SEED) {
      expect(produto.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(produto.preco).toMatch(/^[1-9]\d*\.\d{2}$/);
      expect(Number.isInteger(produto.estoque) && produto.estoque > 0).toBe(
        true,
      );
      expect(produto.ativo).toBe(true);
      expect(new URL(produto.imagemUrl).hostname).toBe('images.pexels.com');
    }
  });

  it('generates conflict-safe inserts on repeated runs without updating existing products', async () => {
    const source = new SeedDataSource({
      type: 'postgres',
      entities: [Produto],
      synchronize: false,
    });
    await source.buildEntityMetadata();
    jest
      .spyOn(source, 'transaction')
      .mockImplementation(async (callback: unknown) => {
        await (callback as (manager: typeof source.manager) => Promise<void>)(
          source.manager,
        );
      });
    const queries: string[] = [];
    jest
      .spyOn(InsertQueryBuilder.prototype, 'execute')
      .mockImplementation(function (this: InsertQueryBuilder<Produto>) {
        queries.push(this.getQuery());
        return Promise.resolve(new InsertResult());
      });
    await seedProdutos(source);
    await seedProdutos(source);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe(queries[1]);
    for (const query of queries) {
      expect(query).toContain('ON CONFLICT DO NOTHING');
      expect(query).not.toContain('DO UPDATE');
    }
  });
});

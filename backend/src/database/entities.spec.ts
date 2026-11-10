import { DataSource } from 'typeorm';
import { Produto } from '../produtos/entities/produto.entity';
import { Pedido } from '../pedidos/entities/pedido.entity';
import { ItemPedido } from '../pedidos/entities/item-pedido.entity';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';

class MetadataDataSource extends DataSource {
  async buildEntityMetadata() {
    await this.buildMetadatas();
  }
}

describe('Entity mappings', () => {
  let source: MetadataDataSource;

  beforeAll(async () => {
    source = new MetadataDataSource({
      type: 'postgres',
      entities: [Produto, Pedido, ItemPedido],
      synchronize: false,
    });
    await source.buildEntityMetadata();
  });

  it('maps monetary columns to exact decimals', () => {
    for (const [entity, fields] of [
      [Produto, ['preco']],
      [Pedido, ['valorTotal']],
      [ItemPedido, ['precoUnitario', 'subtotal']],
    ] as const) {
      const metadata = source.getMetadata(entity);
      for (const field of fields) {
        expect(metadata.findColumnWithPropertyName(field)).toMatchObject({
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: false,
        });
      }
    }
  });

  it('requires item relations and protects order history from deletion', () => {
    const metadata = source.getMetadata(ItemPedido);
    expect(metadata.foreignKeys).toHaveLength(2);
    for (const relation of metadata.relations) {
      expect(relation).toMatchObject({
        relationType: 'many-to-one',
        isNullable: false,
        onDelete: 'RESTRICT',
      });
    }
    expect(
      source.getMetadata(Pedido).findRelationWithPropertyPath('itens'),
    ).toMatchObject({
      relationType: 'one-to-many',
      inverseEntityMetadata: metadata,
    });
  });

  it('sets defaults and enforces stock, quantity and subtotal constraints', () => {
    expect(
      source.getMetadata(Produto).findColumnWithPropertyName('ativo')?.default,
    ).toBe(true);
    expect(
      source.getMetadata(Pedido).findColumnWithPropertyName('status'),
    ).toMatchObject({
      enum: ['CONFIRMADO', 'CANCELADO'],
      default: StatusPedido.CONFIRMADO,
    });
    expect(
      source.getMetadata(Produto).checks.map((check) => check.expression),
    ).toContain('"estoque" >= 0');
    expect(
      source.getMetadata(ItemPedido).checks.map((check) => check.expression),
    ).toEqual(
      expect.arrayContaining([
        '"quantidade" > 0',
        '"subtotal" = "quantidade"::numeric * "precoUnitario"',
      ]),
    );
  });
});

import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Produto } from '../../src/produtos/entities/produto.entity';
import { Pedido } from '../../src/pedidos/entities/pedido.entity';
import { ItemPedido } from '../../src/pedidos/entities/item-pedido.entity';

export const PRODUTO_TESTE_ID = 'a17a0000-0000-4000-8000-000000000001';

export class CheckoutDatabase {
  produtos: Produto[] = [];
  pedidos: Pedido[] = [];
  itens: ItemPedido[] = [];
  falharItem = false;
  falharCommit = false;
  readonly bloqueios: string[] = [];
  readonly ordenacoes: string[] = [];
  private fila: Promise<void> = Promise.resolve();

  reset() {
    this.produtos = [
      Object.assign(new Produto(), {
        id: PRODUTO_TESTE_ID,
        nome: 'Blusa',
        descricao: null,
        preco: '19.90',
        imagemUrl: 'https://example.test/blusa.jpg',
        categoria: 'Blusas',
        ativo: true,
        estoque: 10,
      }),
    ];
    this.pedidos = [];
    this.itens = [];
    this.falharItem = false;
    this.falharCommit = false;
    this.bloqueios.length = 0;
    this.ordenacoes.length = 0;
  }

  async transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const anterior = this.fila;
    let liberar!: () => void;
    this.fila = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await anterior;
    try {
      const produtos = this.produtos.map((produto) =>
        Object.assign(new Produto(), produto),
      );
      const pedidos: Pedido[] = [];
      const itens: ItemPedido[] = [];
      let ids: string[] = [];
      const builder = {
        where: (_sql: string, parameters: { ids: string[] }) => {
          ids = parameters.ids;
          return builder;
        },
        orderBy: (field: string, order: string) => {
          this.ordenacoes.push(`${field} ${order}`);
          return builder;
        },
        setLock: (mode: string) => {
          this.bloqueios.push(mode);
          return builder;
        },
        getMany: () =>
          Promise.resolve(
            produtos
              .filter((produto) => ids.includes(produto.id))
              .sort((a, b) => a.id.localeCompare(b.id)),
          ),
      };
      const manager = {
        getRepository: () => ({ createQueryBuilder: () => builder }),
        create: (entity: typeof Pedido | typeof ItemPedido, value: object) =>
          Object.assign(new entity(), value),
        save: (entity: unknown, value: unknown) => {
          if (entity === Pedido) {
            const pedido = value as Pedido;
            pedido.id = randomUUID();
            pedidos.push(pedido);
          }
          if (entity === ItemPedido) {
            if (this.falharItem)
              return Promise.reject(new Error('Simulated persistence failure'));
            itens.push(...(value as ItemPedido[]));
          }
          return Promise.resolve(value);
        },
      } as unknown as EntityManager;
      const resultado = await work(manager);
      if (this.falharCommit) throw new Error('Simulated commit failure');
      this.produtos = produtos;
      this.pedidos.push(...pedidos);
      this.itens.push(...itens);
      return resultado;
    } finally {
      liberar();
    }
  }
}

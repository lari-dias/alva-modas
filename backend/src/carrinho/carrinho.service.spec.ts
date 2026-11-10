import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Produto } from '../produtos/entities/produto.entity';
import { CarrinhoService } from './carrinho.service';
import { LIMITES_CARRINHO } from './carrinho.constants';

describe('CarrinhoService', () => {
  let service: CarrinhoService;
  let produtos: Produto[];
  const repository = { find: jest.fn() };
  const idProduto = (index: number) =>
    `a17a0000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const adicionar = (quantidade = 1, id?: string, produtoId = idProduto(1)) =>
    service.adicionar({ produtoId, quantidade }, id);

  beforeEach(async () => {
    produtos = Array.from({ length: 21 }, (_, i) =>
      Object.assign(new Produto(), {
        id: idProduto(i + 1),
        nome: `Produto ${i + 1}`,
        descricao: null,
        preco: '0.10',
        imagemUrl: 'https://example.com/produto.jpg',
        categoria: 'Blusas',
        ativo: true,
        estoque: 1000,
      }),
    );
    repository.find
      .mockReset()
      .mockImplementation(() => Promise.resolve(produtos));
    const module = await Test.createTestingModule({
      providers: [
        CarrinhoService,
        { provide: getRepositoryToken(Produto), useValue: repository },
      ],
    }).compile();
    service = module.get(CarrinhoService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('creates a server UUID and increments an existing item without duplication', async () => {
    const cart = await adicionar(2);
    expect(cart.idCarrinho).toMatch(/^[0-9a-f-]{14}4[0-9a-f-]{21}$/);
    const updated = await adicionar(3, cart.idCarrinho);
    expect(updated.itens).toHaveLength(1);
    expect(updated.itens[0].quantidade).toBe(5);
    expect(updated.totalCentavos).toBe(50);
    expect(produtos[0].estoque).toBe(1000);
  });

  it('sets an absolute quantity and removes the last item with zero', async () => {
    const cart = await adicionar(2);
    const updated = await service.atualizar(
      { produtoId: idProduto(1), quantidade: 4 },
      cart.idCarrinho,
    );
    expect(updated.itens[0].quantidade).toBe(4);
    expect(
      await service.atualizar(
        { produtoId: idProduto(1), quantidade: 0 },
        cart.idCarrinho,
      ),
    ).toEqual({
      idCarrinho: cart.idCarrinho,
      itens: [],
      totalCentavos: 0,
    });
  });

  it('calculates exact cent totals for several products and reloads current prices', async () => {
    produtos[1].preco = '0.20';
    const cart = await adicionar(3);
    const updated = await adicionar(2, cart.idCarrinho, idProduto(2));
    expect(updated.itens.map((item) => item.subtotalCentavos)).toEqual([
      30, 40,
    ]);
    expect(updated.totalCentavos).toBe(70);
    produtos[0].preco = '19.99';
    expect((await service.consultar(cart.idCarrinho)).totalCentavos).toBe(6037);
  });

  it('keeps independent carts isolated', async () => {
    const first = await adicionar(2);
    const second = await adicionar(3);
    expect(first.idCarrinho).not.toBe(second.idCarrinho);
    expect(
      (await service.consultar(first.idCarrinho)).itens[0].quantidade,
    ).toBe(2);
  });

  it('rejects nonexistent and inactive products', async () => {
    await expect(adicionar(1, undefined, idProduto(99))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    produtos[0].ativo = false;
    await expect(adicionar()).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates accumulated quantity against stock and preserves state on failure', async () => {
    produtos[0].estoque = 3;
    const cart = await adicionar(2);
    await expect(adicionar(2, cart.idCarrinho)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect((await service.consultar(cart.idCarrinho)).itens[0].quantidade).toBe(
      2,
    );
    await expect(
      service.atualizar(
        { produtoId: idProduto(1), quantidade: 4 },
        cart.idCarrinho,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revalidates stock and activity on reads and permits removal of unavailable products', async () => {
    const cart = await adicionar(2);
    produtos[0].estoque = 1;
    await expect(service.consultar(cart.idCarrinho)).rejects.toBeInstanceOf(
      ConflictException,
    );
    produtos[0].ativo = false;
    expect(
      (
        await service.atualizar(
          { produtoId: idProduto(1), quantidade: 0 },
          cart.idCarrinho,
        )
      ).itens,
    ).toEqual([]);
  });

  it.each(['inactive', 'stock', 'deleted'])(
    'recovers items independently when two products become %s',
    async (scenario) => {
      const cart = await adicionar(4);
      await adicionar(4, cart.idCarrinho, idProduto(2));
      if (scenario === 'inactive')
        produtos.slice(0, 2).forEach((p) => {
          p.ativo = false;
        });
      if (scenario === 'stock')
        produtos.slice(0, 2).forEach((p) => {
          p.estoque = 1;
        });
      if (scenario === 'deleted') produtos = produtos.slice(2);
      const reduced = await service.atualizar(
        { produtoId: idProduto(1), quantidade: 3 },
        cart.idCarrinho,
      );
      expect(reduced.itens.map((i) => i.quantidade)).toEqual([3, 4]);
      expect(reduced.itens.every((i) => !i.disponivel)).toBe(true);
      await expect(adicionar(1, cart.idCarrinho)).rejects.toBeDefined();
      await expect(
        service.atualizar(
          { produtoId: idProduto(1), quantidade: 4 },
          cart.idCarrinho,
        ),
      ).rejects.toBeDefined();
      const removed = await service.atualizar(
        { produtoId: idProduto(1), quantidade: 0 },
        cart.idCarrinho,
      );
      expect(removed.itens).toHaveLength(1);
      expect(removed.itens[0].produto.id).toBe(idProduto(2));
      expect(
        (
          await service.atualizar(
            { produtoId: idProduto(2), quantidade: 0 },
            cart.idCarrinho,
          )
        ).itens,
      ).toEqual([]);
    },
  );

  it('distinguishes missing carts from missing products and preserves the cart', async () => {
    const cart = await adicionar();
    produtos = [];
    await expect(service.consultar(cart.idCarrinho)).rejects.toMatchObject({
      response: { code: 'PRODUCT_NOT_FOUND' },
    });
    await expect(service.consultar(idProduto(99))).rejects.toMatchObject({
      response: { code: 'CART_NOT_FOUND' },
    });
    await expect(
      service.atualizar(
        { produtoId: idProduto(2), quantidade: 0 },
        cart.idCarrinho,
      ),
    ).rejects.toMatchObject({ response: { code: 'CART_ITEM_NOT_FOUND' } });
    expect(
      (
        await service.atualizar(
          { produtoId: idProduto(1), quantidade: 0 },
          cart.idCarrinho,
        )
      ).itens,
    ).toEqual([]);
  });

  it.each([-1, 0, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid additions: %s',
    async (quantidade) => {
      await expect(adicionar(quantidade)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.find).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 1.5, 101])('rejects invalid updates: %s', async (quantidade) => {
    const cart = await adicionar();
    await expect(
      service.atualizar(
        { produtoId: idProduto(1), quantidade },
        cart.idCarrinho,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects nonexistent carts and items instead of creating a client-selected cart', async () => {
    await expect(adicionar(1, idProduto(99))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const cart = await adicionar();
    await expect(
      service.atualizar(
        { produtoId: idProduto(2), quantidade: 0 },
        cart.idCarrinho,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('limits total units and cumulative units per item', async () => {
    const cart = await adicionar(100);
    await expect(adicionar(1, cart.idCarrinho)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      adicionar(1, cart.idCarrinho, idProduto(2)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limits distinct items', async () => {
    const cart = await adicionar();
    for (let i = 2; i <= LIMITES_CARRINHO.itens; i++)
      await adicionar(1, cart.idCarrinho, idProduto(i));
    await expect(
      adicionar(1, cart.idCarrinho, idProduto(21)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.consultar(cart.idCarrinho)).itens).toHaveLength(20);
  });

  it('caps the number of carts and cleans them after expiration', async () => {
    jest.useFakeTimers();
    service.onModuleInit();
    for (let i = 0; i < LIMITES_CARRINHO.carrinhos; i++) await adicionar();
    await expect(adicionar()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    jest.advanceTimersByTime(LIMITES_CARRINHO.expiracaoMs);
    await expect(adicionar()).resolves.toHaveProperty('idCarrinho');
  });

  it('expires inactive carts and refreshes the lifetime after successful reads', async () => {
    jest.useFakeTimers();
    const cart = await adicionar();
    jest.advanceTimersByTime(LIMITES_CARRINHO.expiracaoMs - 1);
    await service.consultar(cart.idCarrinho);
    jest.advanceTimersByTime(1);
    await service.consultar(cart.idCarrinho);
    jest.advanceTimersByTime(LIMITES_CARRINHO.expiracaoMs);
    await expect(service.consultar(cart.idCarrinho)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects overlapping operations on one cart without losing updates', async () => {
    const cart = await adicionar();
    let resolve!: (value: Produto[]) => void;
    repository.find.mockImplementationOnce(
      () =>
        new Promise<Produto[]>((done) => {
          resolve = done;
        }),
    );
    const pending = adicionar(2, cart.idCarrinho);
    await expect(adicionar(1, cart.idCarrinho)).rejects.toBeInstanceOf(
      ConflictException,
    );
    resolve(produtos);
    expect((await pending).itens[0].quantidade).toBe(3);
  });
});

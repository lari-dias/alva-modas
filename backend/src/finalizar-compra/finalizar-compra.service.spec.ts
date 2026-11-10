import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CarrinhoService } from '../carrinho/carrinho.service';
import { Produto } from '../produtos/entities/produto.entity';
import { EmailService } from '../email/email.service';
import { StatusEnvioEmail } from '../email/confirmacao-pedido';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { FinalizarCompraService } from './finalizar-compra.service';
import {
  CheckoutDatabase,
  PRODUTO_TESTE_ID,
} from '../../test/support/checkout-database';

describe('FinalizarCompraService', () => {
  const db = new CheckoutDatabase();
  const email = { enviarConfirmacao: jest.fn() };
  const cliente = { nome: 'Maria Silva', email: 'cliente@example.test' };
  let carrinhos: CarrinhoService;
  let service: FinalizarCompraService;
  const criarCarrinho = (quantidade = 2) =>
    carrinhos.adicionar({ produtoId: PRODUTO_TESTE_ID, quantidade });

  beforeEach(async () => {
    db.reset();
    email.enviarConfirmacao
      .mockReset()
      .mockResolvedValue(StatusEnvioEmail.ACEITO_PELO_SMTP);
    const module = await Test.createTestingModule({
      providers: [
        CarrinhoService,
        FinalizarCompraService,
        { provide: DataSource, useValue: db },
        { provide: EmailService, useValue: email },
        {
          provide: getRepositoryToken(Produto),
          useValue: { find: () => Promise.resolve(db.produtos) },
        },
      ],
    }).compile();
    carrinhos = module.get(CarrinhoService);
    service = module.get(FinalizarCompraService);
  });

  afterEach(() => {
    carrinhos.onModuleDestroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('commits order, historical items and stock before removing the cart and sending email', async () => {
    const cart = await criarCarrinho();
    db.produtos[0].nome = 'Blusa Atual';
    db.produtos[0].preco = '29.99';
    email.enviarConfirmacao.mockImplementation(async () => {
      expect(db.pedidos).toHaveLength(1);
      expect(db.produtos[0].estoque).toBe(8);
      await expect(carrinhos.consultar(cart.idCarrinho)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      return StatusEnvioEmail.ACEITO_PELO_SMTP;
    });
    const resultado = await service.finalizar(cart.idCarrinho, cliente);
    expect(resultado).toMatchObject({
      status: StatusPedido.CONFIRMADO,
      totalCentavos: 5998,
      emailStatus: StatusEnvioEmail.ACEITO_PELO_SMTP,
    });
    expect(db.pedidos[0]).toMatchObject({
      valorTotal: '59.98',
      nomeCliente: cliente.nome,
      emailCliente: cliente.email,
    });
    expect(db.itens[0]).toMatchObject({
      nomeProduto: 'Blusa Atual',
      precoUnitario: '29.99',
      subtotal: '59.98',
      quantidade: 2,
    });
    expect(db.bloqueios).toEqual(['pessimistic_write']);
    expect(db.ordenacoes).toEqual(['produto.id ASC']);
  });

  it('rejects empty, unknown and expired carts without starting a transaction', async () => {
    const transaction = jest.spyOn(db, 'transaction');
    const cart = await criarCarrinho();
    await carrinhos.atualizar(
      { produtoId: PRODUTO_TESTE_ID, quantidade: 0 },
      cart.idCarrinho,
    );
    await expect(
      service.finalizar(cart.idCarrinho, cliente),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.finalizar(PRODUTO_TESTE_ID, cliente),
    ).rejects.toBeInstanceOf(NotFoundException);
    jest.useFakeTimers();
    const expirado = await criarCarrinho();
    jest.advanceTimersByTime(30 * 60 * 1000);
    await expect(
      service.finalizar(expirado.idCarrinho, cliente),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(['estoque', 'inativo', 'inexistente'])(
    'rejects a product that became unavailable: %s',
    async (reason) => {
      const cart = await criarCarrinho();
      if (reason === 'estoque') db.produtos[0].estoque = 1;
      if (reason === 'inativo') db.produtos[0].ativo = false;
      if (reason === 'inexistente') db.produtos = [];
      await expect(
        service.finalizar(cart.idCarrinho, cliente),
      ).rejects.toBeInstanceOf(
        reason === 'inexistente' ? NotFoundException : ConflictException,
      );
      expect(db.pedidos).toHaveLength(0);
      expect(email.enviarConfirmacao).not.toHaveBeenCalled();
    },
  );

  it.each(['item', 'commit'])(
    'keeps the cart and rolls back all changes when persistence fails: %s',
    async (stage) => {
      const cart = await criarCarrinho();
      db.falharItem = stage === 'item';
      db.falharCommit = stage === 'commit';
      await expect(
        service.finalizar(cart.idCarrinho, cliente),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.pedidos).toEqual([]);
      expect(db.itens).toEqual([]);
      expect(db.produtos[0].estoque).toBe(10);
      expect(
        (await carrinhos.consultar(cart.idCarrinho)).itens[0].quantidade,
      ).toBe(2);
      expect(email.enviarConfirmacao).not.toHaveBeenCalled();
      db.falharItem = false;
      db.falharCommit = false;
      await expect(
        service.finalizar(cart.idCarrinho, cliente),
      ).resolves.toHaveProperty('idPedido');
    },
  );

  it('prevents simultaneous finalizations and modifications of the same cart', async () => {
    const cart = await criarCarrinho();
    const first = service.finalizar(cart.idCarrinho, cliente);
    await expect(
      service.finalizar(cart.idCarrinho, cliente),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      carrinhos.atualizar(
        { produtoId: PRODUTO_TESTE_ID, quantidade: 1 },
        cart.idCarrinho,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await first;
    expect(db.pedidos).toHaveLength(1);
    expect(email.enviarConfirmacao).toHaveBeenCalledTimes(1);
  });

  it('prevents overselling when two carts compete for the last unit', async () => {
    const first = await criarCarrinho(1);
    const second = await criarCarrinho(1);
    db.produtos[0].estoque = 1;
    const results = await Promise.allSettled([
      service.finalizar(first.idCarrinho, cliente),
      service.finalizar(second.idCarrinho, cliente),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.reason as unknown).toBeInstanceOf(ConflictException);
    expect(db.produtos[0].estoque).toBe(0);
    expect(db.pedidos).toHaveLength(1);
  });

  it('rejects a second checkout after success', async () => {
    const cart = await criarCarrinho();
    await service.finalizar(cart.idCarrinho, cliente);
    await expect(
      service.finalizar(cart.idCarrinho, cliente),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.pedidos).toHaveLength(1);
  });

  it('preserves a committed sale when email fails', async () => {
    const cart = await criarCarrinho();
    email.enviarConfirmacao.mockRejectedValue(new Error('SMTP unavailable'));
    expect(
      (await service.finalizar(cart.idCarrinho, cliente)).emailStatus,
    ).toBe(StatusEnvioEmail.FALHOU);
    expect(db.pedidos).toHaveLength(1);
    expect(db.produtos[0].estoque).toBe(8);
    await expect(carrinhos.consultar(cart.idCarrinho)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports disabled email without claiming delivery', async () => {
    const cart = await criarCarrinho();
    email.enviarConfirmacao.mockResolvedValue(StatusEnvioEmail.DESABILITADO);
    expect(
      (await service.finalizar(cart.idCarrinho, cliente)).emailStatus,
    ).toBe(StatusEnvioEmail.DESABILITADO);
  });

  it('rejects totals exceeding numeric(10,2) without writing anything', async () => {
    const cart = await criarCarrinho();
    db.produtos[0].preco = '99999999.99';
    await expect(
      service.finalizar(cart.idCarrinho, cliente),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(db.pedidos).toHaveLength(0);
    expect(db.produtos[0].estoque).toBe(10);
  });
});

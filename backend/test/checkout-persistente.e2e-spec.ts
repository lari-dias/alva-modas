import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { FinalizarCompraModule } from '../src/finalizar-compra/finalizar-compra.module';
import { CheckoutTentativasService } from '../src/finalizar-compra/checkout-tentativas.service';
import { CheckoutOutboxService } from '../src/finalizar-compra/checkout-outbox.service';
import { FinalizarCompraService } from '../src/finalizar-compra/finalizar-compra.service';
import { CarrinhoService } from '../src/carrinho/carrinho.service';
import { CarrinhoCheckoutService } from '../src/carrinho/carrinho-checkout.service';
import { Produto } from '../src/produtos/entities/produto.entity';
import { Pedido } from '../src/pedidos/entities/pedido.entity';
import { EmailService } from '../src/email/email.service';
import {
  ConfirmacaoPedido,
  StatusEnvioEmail,
} from '../src/email/confirmacao-pedido';
import { StatusPedido } from '../src/pedidos/enums/status-pedido.enum';
import { FinalizarCompraController } from '../src/finalizar-compra/finalizar-compra.controller';
import { CheckoutDeploymentService } from '../src/finalizar-compra/checkout-deployment.service';

const suite =
  process.env.CHECKOUT_ISOLATED_TESTS === 'true' ? describe : describe.skip;

suite('Checkout persistente em PostgreSQL isolado', () => {
  const db = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 55439,
    username: 'postgres',
    password: 'alva-isolated-test',
    database: 'alva_checkout_test',
    entities: [join(__dirname, '../src/**/*.entity.ts')],
    migrations: [join(__dirname, '../src/database/migrations/*.ts')],
    synchronize: false,
  });
  let carrinhos: CarrinhoService;
  let compras: FinalizarCompraService;
  let service: CheckoutTentativasService;
  let produto: Produto;
  let cartId: string;
  let id: string;
  let acesso: { clienteId: string | null; token: string };
  const cliente = { nome: 'Cliente Teste', email: 'cliente@example.test' };
  const preparar = () => service.preparar(id, cartId, cliente, acesso);

  it('pausa novas confirmações, drena a transação admitida e mantém recuperação disponível', async () => {
    await preparar();
    const deployment = new CheckoutDeploymentService(db);
    expect(await deployment.estrutura()).toEqual({ schemaEPermissoes: true });
    let liberar!: () => void;
    let entrou!: () => void;
    const barreira = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const entrada = new Promise<void>((resolve) => {
      entrou = resolve;
    });
    const original = new FinalizarCompraService(
      carrinhos,
      db,
      {} as EmailService,
    );
    jest.spyOn(compras, 'confirmar').mockImplementation(async (...args) => {
      entrou();
      await barreira;
      return original.confirmar(...args);
    });
    const confirmacao = service.confirmar(id, acesso);
    await entrada;
    let drenou = false;
    const pausa = deployment.pausar().then((status) => {
      drenou = true;
      return status;
    });
    try {
      for (
        let index = 0;
        index < 100 && (await deployment.status()).aberto;
        index++
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect((await deployment.status()).aberto).toBe(false);
      expect(drenou).toBe(false);
      await expect(
        service.preparar(randomUUID(), cartId, cliente, acesso),
      ).rejects.toThrow('atualizando');
    } finally {
      liberar();
    }
    expect((await confirmacao).estado).toBe('CONFIRMADA');
    expect(await pausa).toMatchObject({ aberto: false, drenado: true });
    expect(await db.query('SELECT * FROM email_outbox')).toHaveLength(1);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(8);
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'CONFIRMADA',
    );
    expect(await db.getRepository(Pedido).count()).toBe(1);
  });

  it('retira o legado somente após pausa e drenagem e permite reabertura controlada', async () => {
    const deployment = new CheckoutDeploymentService(db);
    await db.query('UPDATE checkout_controle SET legado_retirado = false');
    await expect(deployment.legado()).rejects.toThrow('atualização');
    await expect(deployment.retirarLegado()).rejects.toThrow(
      'pausado e drenado',
    );
    await deployment.pausar();
    await deployment.retirarLegado();
    await expect(deployment.legado()).rejects.toThrow('Atualize a loja');
    await deployment.abrir();
    await preparar();
    expect((await service.confirmar(id, acesso)).estado).toBe('CONFIRMADA');
    await expect(deployment.abrir()).rejects.toThrow('drenagem');
  });

  beforeAll(async () => {
    await db.initialize();
    await db.runMigrations({ transaction: 'all' });
  }, 30000);
  beforeEach(async () => {
    await db.query(
      'UPDATE checkout_controle SET aberto = true, drenado = false, legado_retirado = true WHERE id = true',
    );
    await db.query(
      'TRUNCATE email_outbox, checkout_tentativas, checkout_carrinhos, itens_pedido, pedidos, produtos, clientes CASCADE',
    );
    produto = await db.getRepository(Produto).save({
      nome: 'Blusa',
      descricao: null,
      preco: '19.90',
      imagemUrl: 'https://example.test/blusa.jpg',
      categoria: 'Blusas',
      estoque: 10,
      ativo: true,
    });
    carrinhos = new CarrinhoService(db.getRepository(Produto));
    compras = new FinalizarCompraService(carrinhos, db, {} as EmailService);
    service = new CheckoutTentativasService(
      db,
      carrinhos,
      compras,
      new CheckoutDeploymentService(db),
    );
    cartId = (
      await carrinhos.adicionar({ produtoId: produto.id, quantidade: 2 })
    ).idCarrinho;
    id = randomUUID();
    acesso = { clienteId: null, token: randomBytes(32).toString('hex') };
  });
  afterEach(() => carrinhos.onModuleDestroy());
  afterAll(async () => {
    if (db.isInitialized) await db.destroy();
  });

  it('confirma, repete e recupera sem duplicar pedido ou estoque', async () => {
    await preparar();
    const primeiro = await service.confirmar(id, acesso);
    expect(primeiro.estado).toBe('CONFIRMADA');
    await expect(carrinhos.consultar(cartId)).rejects.toThrow('não encontrado');
    expect(await service.confirmar(id, acesso)).toEqual(primeiro);
    expect(await service.consultar(id, acesso, cartId)).toEqual(primeiro);
    expect(await db.getRepository(Pedido).count()).toBe(1);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(8);
    expect(await db.query('SELECT * FROM email_outbox')).toHaveLength(1);
  });

  it('serializa duas confirmações concorrentes em conexões distintas', async () => {
    await preparar();
    const resultados = await Promise.all([
      service.confirmar(id, acesso),
      service.confirmar(id, acesso),
    ]);
    expect(resultados[0]).toEqual(resultados[1]);
    expect(await db.getRepository(Pedido).count()).toBe(1);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(8);
  });

  it('recupera um COMMIT confirmado pelo banco mesmo quando a confirmação da conexão falha', async () => {
    await preparar();
    const criarRunner = db.createQueryRunner.bind(
      db,
    ) as DataSource['createQueryRunner'];
    const spy = jest
      .spyOn(db, 'createQueryRunner')
      .mockImplementationOnce((mode) => {
        const runner = criarRunner(mode);
        const commit = runner.commitTransaction.bind(
          runner,
        ) as () => Promise<void>;
        jest
          .spyOn(runner, 'commitTransaction')
          .mockImplementationOnce(async () => {
            await commit();
            throw new Error('Confirmação do COMMIT perdida');
          });
        return runner;
      });
    try {
      await expect(service.confirmar(id, acesso)).rejects.toThrow(
        'COMMIT perdida',
      );
    } finally {
      spy.mockRestore();
    }
    expect((await service.confirmar(id, acesso)).estado).toBe('CONFIRMADA');
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'CONFIRMADA',
    );
    expect(await db.getRepository(Pedido).count()).toBe(1);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(8);
    expect(await db.query('SELECT * FROM email_outbox')).toHaveLength(1);
  });

  it('consulta e reduz estoque indisponível sem depender do cache do navegador', async () => {
    await db.getRepository(Produto).update(produto.id, { estoque: 1 });
    expect((await carrinhos.consultar(cartId)).itens[0]).toMatchObject({
      quantidade: 2,
      disponivel: false,
      produto: { estoque: 1 },
    });
    expect(
      (
        await carrinhos.atualizar(
          { produtoId: produto.id, quantidade: 1 },
          cartId,
        )
      ).itens[0].disponivel,
    ).toBe(true);
  });

  it('serializa estoque entre carrinhos distintos sem venda acima da disponibilidade', async () => {
    const outroCart = (
      await carrinhos.adicionar({ produtoId: produto.id, quantidade: 2 })
    ).idCarrinho;
    const outroId = randomUUID();
    await preparar();
    await service.preparar(outroId, outroCart, cliente, acesso);
    await db.getRepository(Produto).update(produto.id, { estoque: 3 });
    const respostas = await Promise.all([
      service.confirmar(id, acesso),
      service.confirmar(outroId, acesso),
    ]);
    expect(respostas.map((r) => r.estado).sort()).toEqual([
      'CONFIRMADA',
      'ENCERRADA_SEM_PEDIDO',
    ]);
    expect(await db.getRepository(Pedido).count()).toBe(1);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(1);
  });

  it('bloqueia chaves diferentes no mesmo carrinho e após confirmação', async () => {
    await preparar();
    await expect(
      service.preparar(randomUUID(), cartId, cliente, acesso),
    ).rejects.toThrow('outra tentativa');
    await service.confirmar(id, acesso);
    await expect(
      service.preparar(randomUUID(), cartId, cliente, acesso),
    ).rejects.toThrow('já foi confirmado');
  });

  it('serializa preparações concorrentes com chaves diferentes', async () => {
    const resultados = await Promise.allSettled([
      preparar(),
      service.preparar(randomUUID(), cartId, cliente, acesso),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.query('SELECT * FROM checkout_tentativas')).toHaveLength(1);
  });

  it('rejeita reutilização da chave com dados diferentes', async () => {
    await preparar();
    await expect(
      service.preparar(id, cartId, { ...cliente, nome: 'Outro nome' }, acesso),
    ).rejects.toThrow('outros dados');
  });

  it('bloqueia alterações da sacola enquanto pendente e após confirmação', async () => {
    const gate = new CarrinhoCheckoutService(db);
    const alterar = jest.fn().mockResolvedValue(null);
    await preparar();
    await expect(gate.executar(cartId, alterar)).rejects.toThrow(
      'resultado do checkout',
    );
    await service.confirmar(id, acesso);
    await expect(gate.executar(cartId, alterar)).rejects.toThrow(
      'resultado do checkout',
    );
    expect(alterar).not.toHaveBeenCalled();
  });

  it('libera alterações depois do encerramento sem pedido', async () => {
    await service.consultar(id, acesso, cartId);
    const alterar = jest.fn().mockResolvedValue('liberado');
    expect(
      await new CarrinhoCheckoutService(db).executar(cartId, alterar),
    ).toBe('liberado');
  });

  it('recupera após perda da resposta e reinício do serviço de carrinhos', async () => {
    await preparar();
    await service.confirmar(id, acesso);
    carrinhos.onModuleDestroy();
    const reiniciado = new CheckoutTentativasService(
      db,
      carrinhos,
      compras,
      new CheckoutDeploymentService(db),
    );
    expect((await reiniciado.consultar(id, acesso, cartId)).estado).toBe(
      'CONFIRMADA',
    );
  });

  it('confirma snapshot persistido mesmo sem o Map original', async () => {
    await preparar();
    carrinhos.onModuleDestroy();
    expect((await service.confirmar(id, acesso)).estado).toBe('CONFIRMADA');
  });

  it('mantém tentativa recente em processamento', async () => {
    await preparar();
    expect(await service.consultar(id, acesso, cartId)).toEqual({
      estado: 'PROCESSANDO',
      pedido: null,
    });
  });

  it('encerra tentativa abandonada e impede confirmação atrasada', async () => {
    await preparar();
    await db.query(
      "UPDATE checkout_tentativas SET atualizado_em = now() - interval '16 minutes' WHERE id = $1",
      [id],
    );
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'ENCERRADA_SEM_PEDIDO',
    );
    expect((await service.confirmar(id, acesso)).estado).toBe(
      'ENCERRADA_SEM_PEDIDO',
    );
    expect(await db.getRepository(Pedido).count()).toBe(0);
  });

  it('sela tentativa não recebida antes de liberar o navegador', async () => {
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'ENCERRADA_SEM_PEDIDO',
    );
    await expect(preparar()).rejects.toThrow('outros dados');
    expect((await service.confirmar(id, acesso)).estado).toBe(
      'ENCERRADA_SEM_PEDIDO',
    );
  });

  it('preserva estoque quando a confirmação é rejeitada', async () => {
    await preparar();
    await db.getRepository(Produto).update(produto.id, { estoque: 1 });
    expect((await service.confirmar(id, acesso)).estado).toBe(
      'ENCERRADA_SEM_PEDIDO',
    );
    expect(await db.getRepository(Pedido).count()).toBe(0);
    expect(
      (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
        .estoque,
    ).toBe(1);
    expect(await db.query('SELECT * FROM email_outbox')).toHaveLength(0);
  });

  it('reverte pedido e estoque se a persistência da outbox falhar', async () => {
    await preparar();
    await db.query(`CREATE FUNCTION falhar_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha isolada'; END $$;
      CREATE TRIGGER falhar_outbox BEFORE INSERT ON email_outbox FOR EACH ROW EXECUTE FUNCTION falhar_outbox()`);
    try {
      await expect(service.confirmar(id, acesso)).rejects.toThrow(
        'falha isolada',
      );
      expect((await carrinhos.consultar(cartId)).itens[0].quantidade).toBe(2);
      expect(await db.getRepository(Pedido).count()).toBe(0);
      expect(
        (await db.getRepository(Produto).findOneByOrFail({ id: produto.id }))
          .estoque,
      ).toBe(10);
      expect((await service.consultar(id, acesso, cartId)).estado).toBe(
        'PROCESSANDO',
      );
    } finally {
      await db.query(
        'DROP TRIGGER falhar_outbox ON email_outbox; DROP FUNCTION falhar_outbox()',
      );
    }
  });

  it('não autoriza visitante apenas pelo UUID ou token incorreto', async () => {
    await preparar();
    await expect(
      service.consultar(
        id,
        { clienteId: null, token: randomBytes(32).toString('hex') },
        cartId,
      ),
    ).rejects.toThrow('não encontrada');
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'PROCESSANDO',
    );
  });

  it('não permite a outro usuário consultar tentativa autenticada, mesmo com token', async () => {
    const rows: { id: string }[] = await db.query(
      `INSERT INTO clientes(nome, email, "senhaHash") VALUES ('Cliente', 'cliente@example.test', 'hash') RETURNING id`,
    );
    acesso.clienteId = rows[0].id;
    await preparar();
    await expect(
      service.consultar(id, { ...acesso, clienteId: randomUUID() }, cartId),
    ).rejects.toThrow('não encontrada');
    await expect(
      service.confirmar(id, { ...acesso, clienteId: null }),
    ).rejects.toThrow('não encontrada');
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'PROCESSANDO',
    );
  });

  it('outbox envia uma vez com chave estável e atualiza resultado', async () => {
    await preparar();
    await service.confirmar(id, acesso);
    const enviarConfirmacao = jest
      .fn()
      .mockResolvedValue(StatusEnvioEmail.ACEITO_PELA_API);
    const outbox = new CheckoutOutboxService(
      db,
      { enviarConfirmacao } as unknown as EmailService,
      new ConfigService({ RESEND_API_KEY: 're_test_key' }),
    );
    await Promise.all([outbox.processar(), outbox.processar()]);
    await outbox.processar();
    expect(enviarConfirmacao).toHaveBeenCalledTimes(1);
    expect(
      (enviarConfirmacao.mock.calls as [ConfirmacaoPedido, string][])[0][1],
    ).toMatch(/^checkout\//);
    expect(
      (await service.consultar(id, acesso, cartId)).pedido?.emailStatus,
    ).toBe('ACEITO_PELA_API');
  });

  it('outbox preserva falha e não reenvia fora da janela segura', async () => {
    await preparar();
    await service.confirmar(id, acesso);
    const enviarConfirmacao = jest
      .fn()
      .mockResolvedValue(StatusEnvioEmail.FALHOU);
    const outbox = new CheckoutOutboxService(
      db,
      { enviarConfirmacao } as unknown as EmailService,
      new ConfigService({ RESEND_API_KEY: 're_test_key' }),
    );
    await outbox.processar();
    expect((await service.consultar(id, acesso, cartId)).estado).toBe(
      'CONFIRMADA',
    );
    await db.query(
      "UPDATE email_outbox SET primeira_tentativa = now() - interval '24 hours', proxima_tentativa = now()",
    );
    await outbox.processar();
    expect(enviarConfirmacao).toHaveBeenCalledTimes(1);
    expect(
      (
        await db.query<{ estado: string }[]>('SELECT estado FROM email_outbox')
      )[0].estado,
    ).toBe('REVISAO');
  });

  it.each([StatusEnvioEmail.ACEITO_PELO_SMTP, StatusEnvioEmail.FALHOU])(
    'outbox preserva SMTP com resultado %s e não repete envio incerto',
    async (status) => {
      await preparar();
      await service.confirmar(id, acesso);
      const enviarConfirmacao = jest.fn().mockResolvedValue(status);
      const outbox = new CheckoutOutboxService(
        db,
        { enviarConfirmacao } as unknown as EmailService,
        new ConfigService({ SMTP_ENABLED: true }),
      );
      await outbox.processar();
      await db.query('UPDATE email_outbox SET proxima_tentativa = now()');
      await outbox.processar();
      expect(enviarConfirmacao).toHaveBeenCalledTimes(1);
      const rows: { estado: string }[] = await db.query(
        'SELECT estado FROM email_outbox',
      );
      expect(rows[0].estado).toBe(
        status === StatusEnvioEmail.FALHOU ? 'REVISAO' : 'ENVIADO',
      );
      expect(
        (await service.consultar(id, acesso, cartId)).pedido?.emailStatus,
      ).toBe(
        status === StatusEnvioEmail.FALHOU
          ? StatusEnvioEmail.FALHOU
          : StatusEnvioEmail.ACEITO_PELO_SMTP,
      );
    },
  );

  it('migration preserva pedidos históricos e suporta rollback isolado', async () => {
    const historico = await db.getRepository(Pedido).save({
      nomeCliente: cliente.nome,
      emailCliente: cliente.email,
      valorTotal: '10.00',
      status: StatusPedido.CONFIRMADO,
    });
    await db.undoLastMigration({ transaction: 'all' });
    await db.undoLastMigration({ transaction: 'all' });
    expect(
      await db.getRepository(Pedido).findOneBy({ id: historico.id }),
    ).not.toBeNull();
    await db.runMigrations({ transaction: 'all' });
    expect(
      await db.getRepository(Pedido).findOneBy({ id: historico.id }),
    ).not.toBeNull();
    expect(await new CheckoutDeploymentService(db).status()).toEqual({
      aberto: false,
      drenado: false,
      legado_retirado: false,
    });
  });

  it('endpoint antigo não executa confirmação', async () => {
    const controller = new FinalizarCompraController(
      new CheckoutDeploymentService(db),
    );
    await expect(controller.finalizar(cliente, cartId)).rejects.toThrow(
      'Atualize a loja',
    );
    expect(await db.getRepository(Pedido).count()).toBe(0);
  });

  it('executa checkout e outbox com privilégios mínimos de runtime', async () => {
    await db.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alva_checkout_runtime') THEN
        CREATE ROLE alva_checkout_runtime LOGIN PASSWORD 'isolated-runtime';
      END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO alva_checkout_runtime;
    GRANT SELECT ON produtos TO alva_checkout_runtime;
    GRANT UPDATE (estoque, "atualizadoEm") ON produtos TO alva_checkout_runtime;
    GRANT SELECT, INSERT ON clientes, pedidos, itens_pedido TO alva_checkout_runtime;
    GRANT SELECT, INSERT, UPDATE ON checkout_tentativas, checkout_carrinhos, email_outbox TO alva_checkout_runtime;
    GRANT SELECT, UPDATE ON checkout_controle TO alva_checkout_runtime;
    GRANT USAGE ON TYPE status_pedido_enum TO alva_checkout_runtime`);
    const options = db.options;
    if (options.type !== 'postgres')
      throw new Error('PostgreSQL isolado obrigatório.');
    const runtime = new DataSource({
      ...options,
      username: 'alva_checkout_runtime',
      password: 'isolated-runtime',
      installExtensions: false,
    });
    await runtime.initialize();
    try {
      expect(await new CheckoutDeploymentService(runtime).estrutura()).toEqual({
        schemaEPermissoes: true,
      });
      const sacolas = new CarrinhoService(runtime.getRepository(Produto));
      const sacola = await sacolas.adicionar({
        produtoId: produto.id,
        quantidade: 2,
      });
      const confirmar = new FinalizarCompraService(
        sacolas,
        runtime,
        {} as EmailService,
      );
      const fluxo = new CheckoutTentativasService(
        runtime,
        sacolas,
        confirmar,
        new CheckoutDeploymentService(runtime),
      );
      await fluxo.preparar(id, sacola.idCarrinho, cliente, acesso);
      expect((await fluxo.confirmar(id, acesso)).estado).toBe('CONFIRMADA');
      const enviarConfirmacao = jest
        .fn()
        .mockResolvedValue(StatusEnvioEmail.ACEITO_PELA_API);
      await new CheckoutOutboxService(
        runtime,
        { enviarConfirmacao } as unknown as EmailService,
        new ConfigService({ RESEND_API_KEY: 're_test_key' }),
      ).processar();
      expect(
        (await fluxo.consultar(id, acesso, sacola.idCarrinho)).pedido
          ?.emailStatus,
      ).toBe('ACEITO_PELA_API');
    } finally {
      await runtime.destroy();
    }
  });

  it('integra os módulos reais por HTTP com PostgreSQL e outbox persistente', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              FRONTEND_URL: 'http://localhost:5173',
              JWT_SECRET: 'isolated-checkout-secret-at-least-32-characters',
              SMTP_ENABLED: false,
              CHECKOUT_OUTBOX_ENABLED: false,
            }),
          ],
        }),
        TypeOrmModule.forRoot(db.options),
        FinalizarCompraModule,
      ],
    }).compile();
    const app = module.createNestApplication();
    configureApp(app);
    await app.init();
    try {
      const cart = await app
        .get(CarrinhoService)
        .adicionar({ produtoId: produto.id, quantidade: 2 });
      const servidor = app.getHttpServer() as Parameters<typeof request>[0];
      const caminho = '/auth/checkout/tentativas/' + id;
      await request(servidor)
        .post(caminho)
        .set('X-Cart-Id', cart.idCarrinho)
        .set('X-Checkout-Token', acesso.token)
        .send(cliente)
        .expect(201);
      const resposta = await request(servidor)
        .post(caminho + '/confirmar')
        .set('X-Checkout-Token', acesso.token)
        .expect(201);
      expect((resposta.body as { estado: string }).estado).toBe('CONFIRMADA');
      const repetida = await request(servidor)
        .post(caminho + '/confirmar')
        .set('X-Checkout-Token', acesso.token)
        .expect(201);
      expect(repetida.body).toEqual(resposta.body);
      await request(servidor)
        .put('/carrinho')
        .set('X-Cart-Id', cart.idCarrinho)
        .send({ produtoId: produto.id, quantidade: 3 })
        .expect(409);
      await request(servidor)
        .post('/finalizar-compra')
        .set('X-Cart-Id', cart.idCarrinho)
        .send(cliente)
        .expect(410);
      expect(await db.getRepository(Pedido).count()).toBe(1);
    } finally {
      await app.close();
    }
  });
});

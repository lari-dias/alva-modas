import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CarrinhoService } from '../carrinho/carrinho.service';
import { FinalizarCompraService } from './finalizar-compra.service';
import { FinalizarCompraDto } from './dto/finalizar-compra.dto';
import { CompraRespostaDto } from './dto/compra-resposta.dto';
import { StatusEnvioEmail } from '../email/confirmacao-pedido';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { CheckoutDeploymentService } from './checkout-deployment.service';

type Conteudo = { cliente: FinalizarCompraDto; itens: [string, number][] };
type Tentativa = {
  id: string;
  carrinho_id: string;
  cliente_id: string | null;
  token_hash: string;
  requisicao_hash: string;
  estado: 'PROCESSANDO' | 'CONFIRMADA' | 'ENCERRADA_SEM_PEDIDO';
  conteudo: Conteudo;
  resultado: CompraRespostaDto | null;
  atualizado_em: Date;
};
export type AcessoCheckout = { clienteId: string | null; token: string };
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class CheckoutTentativasService {
  constructor(
    private readonly db: DataSource,
    private readonly carrinhos: CarrinhoService,
    private readonly compras: FinalizarCompraService,
    private readonly deployment: CheckoutDeploymentService,
  ) {}

  private autorizar(t: Tentativa, acesso: AcessoCheckout) {
    const token = Buffer.from(hash(acesso.token));
    const esperado = Buffer.from(t.token_hash);
    if (
      t.cliente_id
        ? t.cliente_id !== acesso.clienteId
        : token.length !== esperado.length || !timingSafeEqual(token, esperado)
    ) {
      throw new NotFoundException('Tentativa não encontrada.');
    }
  }

  private async buscar(
    manager: EntityManager,
    id: string,
    acesso: AcessoCheckout,
    bloquear = false,
  ): Promise<Tentativa> {
    const rows: Tentativa[] = await manager.query(
      `SELECT * FROM checkout_tentativas WHERE id = $1 ${bloquear ? 'FOR UPDATE' : ''}`,
      [id],
    );
    const tentativa = rows[0];
    if (!tentativa) throw new NotFoundException('Tentativa não encontrada.');
    this.autorizar(tentativa, acesso);
    return tentativa;
  }

  async preparar(
    id: string,
    cartId: string,
    cliente: FinalizarCompraDto,
    acesso: AcessoCheckout,
  ) {
    const fingerprint = hash(
      JSON.stringify([cartId, cliente.nome, cliente.email]),
    );
    return this.db.transaction(async (manager) => {
      await this.deployment.admitir(manager);
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [id],
      );
      await manager.query(
        'INSERT INTO checkout_carrinhos(id) VALUES ($1) ON CONFLICT DO NOTHING',
        [cartId],
      );
      const carts: { confirmado: boolean }[] = await manager.query(
        'SELECT confirmado FROM checkout_carrinhos WHERE id = $1 FOR UPDATE',
        [cartId],
      );
      const anteriores: Tentativa[] = await manager.query(
        'SELECT * FROM checkout_tentativas WHERE id = $1',
        [id],
      );
      if (anteriores[0]) {
        this.autorizar(anteriores[0], acesso);
        if (anteriores[0].requisicao_hash !== fingerprint)
          throw new ConflictException('Chave já utilizada com outros dados.');
        return { id, estado: anteriores[0].estado };
      }
      if (carts[0].confirmado)
        throw new ConflictException('Este carrinho já foi confirmado.');
      const ativos: Tentativa[] = await manager.query(
        "SELECT * FROM checkout_tentativas WHERE carrinho_id = $1 AND estado IN ('PROCESSANDO', 'CONFIRMADA')",
        [cartId],
      );
      if (ativos.length)
        throw new ConflictException(
          'Existe outra tentativa para este carrinho. Verifique a confirmação.',
        );
      const carrinho = await this.carrinhos.consultar(cartId);
      if (!carrinho.itens.length)
        throw new ConflictException('Carrinho vazio.');
      const conteudo: Conteudo = {
        cliente,
        itens: carrinho.itens.map((item) => [item.produto.id, item.quantidade]),
      };
      await manager.query(
        `INSERT INTO checkout_tentativas(id, carrinho_id, cliente_id, token_hash, requisicao_hash, estado, conteudo)
        VALUES ($1, $2, $3, $4, $5, 'PROCESSANDO', $6)`,
        [
          id,
          cartId,
          acesso.clienteId,
          hash(acesso.token),
          fingerprint,
          JSON.stringify(conteudo),
        ],
      );
      return { id, estado: 'PROCESSANDO' as const };
    });
  }

  async confirmar(id: string, acesso: AcessoCheckout) {
    let cartId: string | undefined;
    const resultado = await this.db.transaction(async (manager) => {
      await this.deployment.admitir(manager);
      const t = await this.buscar(manager, id, acesso, true);
      cartId = t.carrinho_id;
      if (t.estado !== 'PROCESSANDO')
        return { estado: t.estado, pedido: t.resultado };
      await manager.query('SAVEPOINT confirmar_pedido');
      try {
        const pedido = await this.compras.confirmar(
          manager,
          new Map(t.conteudo.itens),
          t.conteudo.cliente,
        );
        const resultado = {
          idPedido: pedido.idPedido,
          status: StatusPedido.CONFIRMADO,
          itens: pedido.itens,
          totalCentavos: pedido.totalCentavos,
          emailStatus: StatusEnvioEmail.PENDENTE,
        };
        await manager.query(
          "UPDATE checkout_tentativas SET estado = 'CONFIRMADA', pedido_id = $2, resultado = $3, atualizado_em = now() WHERE id = $1",
          [id, pedido.idPedido, JSON.stringify(resultado)],
        );
        await manager.query(
          'UPDATE checkout_carrinhos SET confirmado = true WHERE id = $1',
          [t.carrinho_id],
        );
        await manager.query(
          'INSERT INTO email_outbox(pedido_id, conteudo) VALUES ($1, $2)',
          [pedido.idPedido, JSON.stringify(pedido)],
        );
        return { estado: 'CONFIRMADA' as const, pedido: resultado };
      } catch (error) {
        await manager.query('ROLLBACK TO SAVEPOINT confirmar_pedido');
        if (
          !(error instanceof HttpException) ||
          ![400, 404, 409, 422].includes(error.getStatus())
        )
          throw error;
        await manager.query(
          "UPDATE checkout_tentativas SET estado = 'ENCERRADA_SEM_PEDIDO', atualizado_em = now() WHERE id = $1",
          [id],
        );
        return { estado: 'ENCERRADA_SEM_PEDIDO' as const, pedido: null };
      }
    });
    if (resultado.estado === 'CONFIRMADA' && cartId)
      this.carrinhos.descartarConfirmado(cartId);
    return resultado;
  }

  async consultar(id: string, acesso: AcessoCheckout, cartId: string) {
    return this.db.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [id],
      );
      await manager.query(
        `INSERT INTO checkout_tentativas(id, carrinho_id, cliente_id, token_hash, requisicao_hash, estado, conteudo)
        VALUES ($1, $2, $3, $4, 'CANCELADA_ANTES_DE_PREPARAR', 'ENCERRADA_SEM_PEDIDO', '{}') ON CONFLICT (id) DO NOTHING`,
        [id, cartId, acesso.clienteId, hash(acesso.token)],
      );
      const t = await this.buscar(manager, id, acesso, true);
      if (
        t.estado === 'PROCESSANDO' &&
        Date.now() - new Date(t.atualizado_em).getTime() > 15 * 60 * 1000
      ) {
        await manager.query(
          "UPDATE checkout_tentativas SET estado = 'ENCERRADA_SEM_PEDIDO', atualizado_em = now() WHERE id = $1",
          [id],
        );
        return { estado: 'ENCERRADA_SEM_PEDIDO' as const, pedido: null };
      }
      return { estado: t.estado, pedido: t.resultado };
    });
  }
}

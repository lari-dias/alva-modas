import {
  ConflictException,
  GoneException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type Controle = { aberto: boolean; drenado: boolean; legado_retirado: boolean };
const lock = 17945000;

@Injectable()
export class CheckoutDeploymentService {
  constructor(private readonly db: DataSource) {}

  async status(manager: EntityManager = this.db.manager): Promise<Controle> {
    const rows: Controle[] = await manager.query(
      'SELECT aberto, drenado, legado_retirado FROM checkout_controle WHERE id = true',
    );
    if (!rows[0])
      throw new ServiceUnavailableException(
        'Checkout temporariamente indisponível.',
      );
    return rows[0];
  }

  async admitir(manager: EntityManager) {
    const rows: { adquirido: boolean }[] = await manager.query(
      'SELECT pg_try_advisory_xact_lock_shared($1) AS adquirido',
      [lock],
    );
    if (!rows[0].adquirido || !(await this.status(manager)).aberto)
      throw new ServiceUnavailableException({
        code: 'CHECKOUT_MAINTENANCE',
        message:
          'Estamos atualizando a loja. Sua sacola foi preservada; tente novamente em alguns instantes.',
      });
  }

  async estrutura() {
    const rows: { schemaEPermissoes: boolean }[] = await this.db.query(`SELECT
      COALESCE(bool_and(to_regclass(t) IS NOT NULL
        AND has_table_privilege(current_user, to_regclass(t), 'SELECT')
        AND has_table_privilege(current_user, to_regclass(t), 'INSERT')
        AND has_table_privilege(current_user, to_regclass(t), 'UPDATE')), false)
      AND has_table_privilege(current_user, 'checkout_controle', 'SELECT')
      AND has_table_privilege(current_user, 'checkout_controle', 'UPDATE') AS "schemaEPermissoes"
      FROM unnest(ARRAY['public.checkout_tentativas', 'public.checkout_carrinhos', 'public.email_outbox']) AS t`);
    return rows[0];
  }

  async pausar() {
    await this.db.query(
      'UPDATE checkout_controle SET aberto = false, drenado = false, atualizado_em = now() WHERE id = true',
    );
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lock]);
      await manager.query(
        'UPDATE checkout_controle SET aberto = false, drenado = true, atualizado_em = now() WHERE id = true',
      );
      return this.status(manager);
    });
  }

  async abrir() {
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lock]);
      const controle = await this.status(manager);
      if (!controle.drenado || controle.aberto)
        throw new ConflictException(
          'Pause e conclua a drenagem antes de abrir.',
        );
      await manager.query(
        'UPDATE checkout_controle SET aberto = true, drenado = false, atualizado_em = now() WHERE id = true',
      );
      return this.status(manager);
    });
  }

  async retirarLegado() {
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lock]);
      const controle = await this.status(manager);
      if (controle.aberto || !controle.drenado)
        throw new ConflictException('O checkout deve estar pausado e drenado.');
      await manager.query(
        'UPDATE checkout_controle SET legado_retirado = true, atualizado_em = now() WHERE id = true',
      );
      return this.status(manager);
    });
  }

  async legado(): Promise<never> {
    if ((await this.status()).legado_retirado)
      throw new GoneException(
        'Atualize a loja para utilizar o checkout com recuperação segura.',
      );
    throw new ServiceUnavailableException({
      code: 'CHECKOUT_MAINTENANCE',
      message:
        'Checkout em atualização. Atualize a página em alguns instantes; não reenvie uma compra incerta.',
    });
  }
}

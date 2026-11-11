import { MigrationInterface, QueryRunner } from 'typeorm';

export class CheckoutPersistente1794400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE checkout_tentativas (
        id uuid PRIMARY KEY,
        carrinho_id uuid NOT NULL,
        cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT,
        token_hash text NOT NULL,
        requisicao_hash text NOT NULL,
        estado text NOT NULL CHECK (estado IN ('PROCESSANDO', 'CONFIRMADA', 'ENCERRADA_SEM_PEDIDO')),
        conteudo jsonb NOT NULL,
        pedido_id uuid UNIQUE REFERENCES pedidos(id) ON DELETE RESTRICT,
        resultado jsonb,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CHECK ((estado = 'CONFIRMADA' AND pedido_id IS NOT NULL AND resultado IS NOT NULL)
          OR (estado <> 'CONFIRMADA' AND pedido_id IS NULL AND resultado IS NULL))
      );
      CREATE UNIQUE INDEX checkout_carrinho_ativo ON checkout_tentativas(carrinho_id)
        WHERE estado IN ('PROCESSANDO', 'CONFIRMADA');
      CREATE TABLE checkout_carrinhos (
        id uuid PRIMARY KEY,
        confirmado boolean NOT NULL DEFAULT false
      );
      CREATE TABLE email_outbox (
        pedido_id uuid PRIMARY KEY REFERENCES pedidos(id) ON DELETE RESTRICT,
        conteudo jsonb NOT NULL,
        estado text NOT NULL DEFAULT 'PENDENTE' CHECK (estado IN ('PENDENTE', 'ENVIADO', 'REVISAO')),
        primeira_tentativa timestamptz,
        proxima_tentativa timestamptz NOT NULL DEFAULT now(),
        tentativas integer NOT NULL DEFAULT 0,
        criado_em timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX email_outbox_pendente ON email_outbox(proxima_tentativa) WHERE estado = 'PENDENTE';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE email_outbox; DROP TABLE checkout_tentativas; DROP TABLE checkout_carrinhos',
    );
  }
}

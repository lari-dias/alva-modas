import { MigrationInterface, QueryRunner } from 'typeorm';

export class ControleCheckout1794500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE checkout_controle (
      id boolean PRIMARY KEY DEFAULT true CHECK (id),
      aberto boolean NOT NULL DEFAULT false,
      drenado boolean NOT NULL DEFAULT false,
      legado_retirado boolean NOT NULL DEFAULT false,
      atualizado_em timestamptz NOT NULL DEFAULT now()
    ); INSERT INTO checkout_controle(id) VALUES (true)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE checkout_controle');
  }
}

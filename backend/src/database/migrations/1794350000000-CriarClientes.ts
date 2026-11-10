import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarClientes1794350000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "clientes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "nome" varchar(120) NOT NULL,
      "email" varchar(254) NOT NULL,
      "senhaHash" varchar NOT NULL,
      "criadoEm" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_clientes" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_clientes_email" UNIQUE ("email"),
      CONSTRAINT "CHK_clientes_email_normalizado" CHECK ("email" = lower(trim("email")))
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "clientes"');
  }
}

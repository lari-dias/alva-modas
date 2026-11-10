import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarProdutosPedidosItens1794254400000 implements MigrationInterface {
  name = 'CriarProdutosPedidosItens1794254400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "status_pedido_enum" AS ENUM ('CONFIRMADO', 'CANCELADO')`,
    );
    await queryRunner.query(`
      CREATE TABLE "produtos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "nome" varchar NOT NULL,
        "descricao" text,
        "preco" numeric(10,2) NOT NULL,
        "imagemUrl" varchar NOT NULL,
        "categoria" varchar NOT NULL,
        "estoque" integer NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "criadoEm" timestamp NOT NULL DEFAULT now(),
        "atualizadoEm" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_produtos" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_produtos_estoque" CHECK ("estoque" >= 0),
        CONSTRAINT "CHK_produtos_preco" CHECK ("preco" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "pedidos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "nomeCliente" varchar NOT NULL,
        "emailCliente" varchar NOT NULL,
        "valorTotal" numeric(10,2) NOT NULL,
        "status" "status_pedido_enum" NOT NULL DEFAULT 'CONFIRMADO',
        "criadoEm" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pedidos" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_pedidos_valor_total" CHECK ("valorTotal" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "itens_pedido" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pedidoId" uuid NOT NULL,
        "produtoId" uuid NOT NULL,
        "nomeProduto" varchar NOT NULL,
        "quantidade" integer NOT NULL,
        "precoUnitario" numeric(10,2) NOT NULL,
        "subtotal" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_itens_pedido" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_itens_pedido_quantidade" CHECK ("quantidade" > 0),
        CONSTRAINT "CHK_itens_pedido_preco_unitario" CHECK ("precoUnitario" >= 0),
        CONSTRAINT "CHK_itens_pedido_subtotal" CHECK ("subtotal" >= 0),
        CONSTRAINT "CHK_itens_pedido_subtotal_calculado" CHECK ("subtotal" = "quantidade"::numeric * "precoUnitario"),
        CONSTRAINT "FK_itens_pedido_pedido" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_itens_pedido_produto" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_itens_pedido_pedido" ON "itens_pedido" ("pedidoId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itens_pedido_produto" ON "itens_pedido" ("produtoId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "itens_pedido"`);
    await queryRunner.query(`DROP TABLE "pedidos"`);
    await queryRunner.query(`DROP TABLE "produtos"`);
    await queryRunner.query(`DROP TYPE "status_pedido_enum"`);
  }
}

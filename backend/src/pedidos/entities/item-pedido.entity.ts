import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Produto } from '../../produtos/entities/produto.entity';
import { Pedido } from './pedido.entity';

@Entity('itens_pedido')
@Check('CHK_itens_pedido_quantidade', '"quantidade" > 0')
@Check('CHK_itens_pedido_preco_unitario', '"precoUnitario" >= 0')
@Check('CHK_itens_pedido_subtotal', '"subtotal" >= 0')
@Check(
  'CHK_itens_pedido_subtotal_calculado',
  '"subtotal" = "quantidade"::numeric * "precoUnitario"',
)
export class ItemPedido {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_itens_pedido',
  })
  id!: string;

  @Index('IDX_itens_pedido_pedido')
  @ManyToOne(() => Pedido, (pedido) => pedido.itens, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'pedidoId',
    foreignKeyConstraintName: 'FK_itens_pedido_pedido',
  })
  pedido!: Relation<Pedido>;

  @Index('IDX_itens_pedido_produto')
  @ManyToOne(() => Produto, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'produtoId',
    foreignKeyConstraintName: 'FK_itens_pedido_produto',
  })
  produto!: Relation<Produto>;

  @Column({ type: 'varchar' })
  nomeProduto!: string;

  @Column({ type: 'integer' })
  quantidade!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precoUnitario!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal!: string;
}

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ItemPedido } from './item-pedido.entity';
import { StatusPedido } from '../enums/status-pedido.enum';

@Entity('pedidos')
@Check('CHK_pedidos_valor_total', '"valorTotal" >= 0')
export class Pedido {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_pedidos' })
  id!: string;

  @Column({ type: 'varchar' })
  nomeCliente!: string;

  @Column({ type: 'varchar' })
  emailCliente!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valorTotal!: string;

  @Column({
    type: 'enum',
    enum: StatusPedido,
    enumName: 'status_pedido_enum',
    default: StatusPedido.CONFIRMADO,
  })
  status!: StatusPedido;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;

  @OneToMany(() => ItemPedido, (item) => item.pedido)
  itens!: Relation<ItemPedido[]>;
}

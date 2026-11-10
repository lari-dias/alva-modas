import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('produtos')
@Check('CHK_produtos_estoque', '"estoque" >= 0')
@Check('CHK_produtos_preco', '"preco" >= 0')
export class Produto {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_produtos' })
  id!: string;

  @Column({ type: 'varchar' })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  descricao!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  preco!: string;

  @Column({ type: 'varchar' })
  imagemUrl!: string;

  @Column({ type: 'varchar' })
  categoria!: string;

  @Column({ type: 'integer' })
  estoque!: number;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  criadoEm!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  atualizadoEm!: Date;
}

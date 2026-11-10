import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('clientes')
@Unique('UQ_clientes_email', ['email'])
@Check('CHK_clientes_email_normalizado', '"email" = lower(trim("email"))')
export class Cliente {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_clientes' })
  id: string;

  @Column({ length: 120 })
  nome: string;

  @Column({ length: 254 })
  email: string;

  @Column({ select: false })
  senhaHash: string;

  @CreateDateColumn()
  criadoEm: Date;
}

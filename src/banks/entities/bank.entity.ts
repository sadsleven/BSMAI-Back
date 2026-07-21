import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'banks' })
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código de 4 dígitos (e.g. "0102" para BDV). Único. */
  @Column({ type: 'varchar', length: 8, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Deshabilitado = no aparece como opción en formularios; referencias existentes se conservan. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

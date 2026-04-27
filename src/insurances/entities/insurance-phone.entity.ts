import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Insurance } from './insurance.entity';

@Entity({ name: 'insurance_phones' })
export class InsurancePhone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Exactamente 11 dígitos. Validado en DTO. */
  @Column({ type: 'varchar', length: 11 })
  number: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label?: string | null;

  @ManyToOne(() => Insurance, (i) => i.phones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'insuranceId' })
  insurance: Insurance;

  @Column({ type: 'uuid' })
  insuranceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

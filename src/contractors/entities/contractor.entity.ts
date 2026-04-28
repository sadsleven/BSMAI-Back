import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';

@Entity({ name: 'contractors' })
export class Contractor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nombre del contratista. Permite letras, números y caracteres especiales —
   * NO se aplica la regla restrictiva de `firstName`/`lastName` de personas.
   */
  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Patient, (p) => p.contractors)
  patients: Patient[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

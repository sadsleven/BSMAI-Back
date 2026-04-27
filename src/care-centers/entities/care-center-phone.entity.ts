import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CareCenter } from './care-center.entity';

@Entity({ name: 'care_center_phones' })
export class CareCenterPhone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 11 })
  number: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label?: string | null;

  @ManyToOne(() => CareCenter, (c) => c.phones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'careCenterId' })
  careCenter: CareCenter;

  @Column({ type: 'uuid' })
  careCenterId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

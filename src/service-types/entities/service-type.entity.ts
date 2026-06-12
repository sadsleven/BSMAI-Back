import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tipo de servicio. Guarda el precio "Particular" en USD (opcional) que se cobra
 * al paciente en órdenes Contado / Crédito / Cashea. Los precios por Seguro,
 * Doctor o Centro viven en sus respectivas sub-tablas (`insurance_service_prices`,
 * `doctor_service_prices`, `care_center_service_prices`).
 */
@Entity({ name: 'service_types' })
export class ServiceType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  particularPriceUsd: string | null;

  /**
   * Si true, este ST puede facturarse por cantidad dentro de una orden
   * (ej. sesiones de fisioterapia). Habilita el campo `quantity` por fila.
   */
  @Column({ type: 'boolean', default: false })
  allowsQuantity: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Borrador PARCIAL del Paso 1 de una orden. No es una orden real: guarda el
 * payload crudo del formulario (sin validar) para que el usuario pueda salir y
 * retomar la creación sin volver a cargar todo. Personal (scope por `userId`);
 * se materializa en una `Order` real cuando el Paso 1 se completa, y entonces
 * se borra. `branchId`/`label` son sólo metadatos para listar y reanudar.
 */
@Entity({ name: 'order_drafts' })
@Index('idx_order_drafts_user', ['userId'])
export class OrderDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Sucursal elegida (si ya se eligió). Sólo pista de listado, sin FK dura. */
  @Column({ type: 'uuid', nullable: true })
  branchId?: string | null;

  /** Etiqueta legible para la lista de borradores (ej. "Contado · Juan Pérez"). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label?: string | null;

  /** Valores crudos del formulario del Paso 1 (Partial<OrderValues>). */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

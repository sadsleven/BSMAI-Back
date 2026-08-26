import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';

/** Acciones registradas en el historial de cambios de la orden. */
export type OrderChangeAction =
  | 'create'
  | 'update'
  | 'authorize_amount'
  | 'attend'
  | 'report'
  | 'billing'
  | 'payment_add'
  | 'payment_update'
  | 'payment_remove'
  | 'soft_delete'
  | 'restore'
  | 'cancel'
  | 'uncancel';

/**
 * Historial de cambios por usuario de una orden. Una fila por acción relevante
 * (creación, edición del Paso 1, autorización de monto, transiciones de pasos,
 * pagos, papelera/restauración). Append-only: nunca se edita ni se borra
 * individualmente (el hard-delete de la orden lo arrastra por CASCADE).
 */
@Entity({ name: 'order_change_logs' })
@Index('idx_ocl_order_created', ['orderId', 'createdAt'])
export class OrderChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 32 })
  action: OrderChangeAction;

  /** Detalle por campo `{ campo: { from, to } }`. Null cuando la acción no lleva diff. */
  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, { from?: unknown; to?: unknown }> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

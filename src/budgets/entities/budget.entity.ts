import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Contractor } from '../../contractors/entities/contractor.entity';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { Pathology } from '../../pathologies/entities/pathology.entity';
import { PaymentAccount } from '../../payment-accounts/entities/payment-account.entity';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { BudgetServiceType } from './budget-service-type.entity';

/**
 * Tipo de cobro del presupuesto — define de dónde sale el precio de catálogo
 * de cada servicio, igual que en el Paso 1 de la orden:
 *  - `particular`: `service_types.particularPriceUsd`.
 *  - `insurance`: baremo del seguro elegido (`insurance_service_prices`).
 */
export type BudgetType = 'particular' | 'insurance';

export type BudgetInsuranceSource = 'direct' | 'via_contractor';

/**
 * Presupuesto de servicios: el documento que se le pasa al paciente o al
 * seguro ANTES de que exista la orden. Es el Paso 1 de la orden sin el resto
 * del flujo — sin atención, informe, facturación ni pagos: sólo a quién se le
 * presupuesta, qué servicios y cuánto cuestan.
 *
 * Se exporta en tres plantillas (Excel y PDF), todas desde esta misma fila:
 *  - PACIENTE — montos en Bs con su tasa BCV (`exchangeRate`).
 *  - SEGUROS  — montos en $ + los datos de la cuenta donde paga el seguro
 *               (`paymentAccount`).
 *  - APS      — solicitud de servicio del seguro (formato Altamira).
 *
 * No tiene ciclo de aprobación: el sistema no puede comprobar que el paciente
 * o el seguro dijo que sí. El único hito real es que el presupuesto se haya
 * usado para crear la orden, y eso lo registra `convertedOrder` (botón "Crear
 * orden" del detalle).
 */
@Entity({ name: 'budgets' })
@Index('idx_budgets_branch', ['branchId'])
@Index('idx_budgets_patient', ['patientId'])
@Index('idx_budgets_holder', ['holderId'])
@Index('idx_budgets_date', ['budgetDate'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Valor NUMÉRICO del correlativo. UNIQUE entre los presupuestos vivos
   * (índice parcial `uq_budgets_number_active`, `WHERE "deletedAt" IS NULL`):
   * el número de uno borrado vuelve a quedar libre.
   */
  @Column({ type: 'bigint' })
  number: string;

  /**
   * Correlativo impreso, derivado de {@link number}: `P-` + 5 dígitos
   * (`P-00123`). Se persiste como snapshot para que el documento ya emitido
   * conserve su número aunque cambie el formato.
   */
  @Column({ type: 'varchar', length: 32 })
  budgetNumber: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'varchar', length: 16 })
  type: BudgetType;

  @Column({ type: 'uuid' })
  holderId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'holderId' })
  holder: Patient;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  insuranceId?: string | null;

  @ManyToOne(() => Insurance, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'insuranceId' })
  insurance?: Insurance | null;

  /**
   * Origen del seguro, con la misma regla que la orden: requerido cuando
   * `type='insurance'`; `via_contractor` exige `contractorId` y `direct` lo
   * prohíbe. Validado en service.
   */
  @Column({ type: 'varchar', length: 16, nullable: true })
  insuranceSource?: BudgetInsuranceSource | null;

  @Column({ type: 'uuid', nullable: true })
  contractorId?: string | null;

  @ManyToOne(() => Contractor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'contractorId' })
  contractor?: Contractor | null;

  /**
   * Especialidad principal, DERIVADA de la primera fila de servicios (igual
   * que `orders.specialtyId`). Null en presupuestos cuyas filas no la traen.
   */
  @Column({ type: 'uuid', nullable: true })
  specialtyId?: string | null;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'specialtyId' })
  specialty?: Specialty | null;

  @OneToMany(() => BudgetServiceType, (bst) => bst.budget, { cascade: false })
  budgetServiceTypes: BudgetServiceType[];

  @ManyToMany(() => Pathology, { eager: false })
  @JoinTable({
    name: 'budget_pathologies',
    joinColumn: { name: 'budgetId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'pathologyId', referencedColumnName: 'id' },
  })
  pathologies: Pathology[];

  /**
   * Texto libre que SUSTITUYE a las patologías en la línea "DIAGNÓSTICO" del
   * documento. Vacío ⇒ se imprimen las patologías unidas por " + ". Existe
   * porque el diagnóstico del presupuesto suele venir redactado del médico
   * ("HTA + TRASTORNO DEL RITMO + CA DE MAMAS ST I A") y no siempre calza con
   * el catálogo.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  diagnosisNote?: string | null;

  /** "COMENTARIO/OBSERVACIONES" de la solicitud APS. */
  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  /** "NOMBRE Y ESPECIALIDAD DEL MÉDICO QUE REFIERE" (solicitud APS). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  referringDoctorName?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  referringSpecialtyName?: string | null;

  @Column({ type: 'date' })
  budgetDate: string;

  /**
   * Vigencia del presupuesto. Pasada esa fecha se reporta como vencido
   * (transient {@link Budget.expired}), salvo que ya haya generado su orden:
   * ahí el precio quedó congelado en la orden y la vigencia deja de importar.
   */
  @Column({ type: 'date', nullable: true })
  validUntilDate?: string | null;

  /** Total presupuestado en USD (el ajustado, que es el que se imprime). */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  priceAmount: string;

  /**
   * Suma de los precios de catálogo snapshot al guardar. El ajuste es derivado
   * (`priceAmount − priceBaseAmount`) e igual que en la orden exige motivo.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  priceBaseAmount?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  priceAdjustmentNote?: string | null;

  /**
   * Tasa USD/Bs con la que se imprimen los montos en Bs de la plantilla
   * PACIENTE ("TASA BCV"). Snapshot: el presupuesto entregado no cambia de
   * precio porque la tasa del día siguiente sea otra. Null ⇒ al exportar se
   * usa la tasa vigente.
   */
  @Column({ type: 'uuid', nullable: true })
  exchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate?: ExchangeRate | null;

  /**
   * Cuenta propia que se imprime en la plantilla SEGUROS (banco, RIF y N° de
   * cuenta donde el seguro paga). Null ⇒ el documento sale sin ese bloque.
   */
  @Column({ type: 'uuid', nullable: true })
  paymentAccountId?: string | null;

  @ManyToOne(() => PaymentAccount, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'paymentAccountId' })
  paymentAccount?: PaymentAccount | null;

  /**
   * Orden creada desde este presupuesto. `ON DELETE SET NULL`: borrar la orden
   * no borra el presupuesto, sólo deshace el enlace.
   */
  @Column({ type: 'uuid', nullable: true })
  convertedOrderId?: string | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'convertedOrderId' })
  convertedOrder?: Order | null;

  @Column({ type: 'timestamptz', nullable: true })
  convertedAt?: Date | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  // --- Transient (NO columna). Lo llena `BudgetsService`. ---
  /**
   * Vencido: `validUntilDate` ya pasó y el presupuesto todavía no generó su
   * orden. Derivado al leer — no se almacena, así no hace falta un job que
   * vaya caducando filas.
   */
  expired?: boolean;
}

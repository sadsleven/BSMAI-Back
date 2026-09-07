import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderServiceType } from './entities/order-service-type.entity';
import { OrderProviderReport } from './entities/order-provider-report.entity';
import { OrderInternalOrder } from './entities/order-internal-order.entity';
import { OrderInvoice } from './entities/order-invoice.entity';
import {
  OrderChangeAction,
  OrderChangeLog,
} from './entities/order-change-log.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderServiceTypeRowDto } from './dto/order-service-type.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import {
  CreateOrderPaymentDto,
  UpdateOrderPaymentDto,
} from './dto/order-payment.dto';
import {
  AttendOrderDto,
  AuthorizeOrderAmountDto,
  BillingOrderDto,
  BillingProviderDto,
  CancelOrderDto,
  CancelOrderInvoiceDto,
  ChangeOrderNumberDto,
  IssueOrderInvoiceDto,
  MAX_INVOICE_NUMBER,
  ReportOrderDto,
} from './dto/order-stages.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { Pathology } from '../pathologies/entities/pathology.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { InsuranceServicePrice } from '../insurances/entities/insurance-service-price.entity';
import { DoctorServicePrice } from '../doctors/entities/doctor-service-price.entity';
import { CareCenterServicePrice } from '../care-centers/entities/care-center-service-price.entity';
import { OrderServicePricing } from './entities/order-service-pricing.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../app-config/app-config.service';
import { orderReportProviderKind } from '../files/files.constants';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import {
  ProviderAccountsService,
  ProviderLink,
} from '../provider-accounts/provider-accounts.service';
import {
  computeAmountInUsd,
  resolveUsdRate,
} from '../shared/utils/payment-conversion';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['attended', 'cancelled'],
  attended: ['report_issued', 'cancelled'],
  report_issued: ['finalized', 'cancelled'],
  finalized: [],
  cancelled: [],
};
void ALLOWED_TRANSITIONS;

type ProviderKey = `doctor:${string}` | `care_center:${string}`;

/** Dígitos con los que se imprime el N° de factura (`4912` → `04912`). */
const INVOICE_NUMBER_PAD = 5;
/** El N° de control va 50 por delante del de factura. */
const INVOICE_CONTROL_OFFSET = 50;
/** …y con dos ceros extra adelante (`04912` → `0004962`). */
const INVOICE_CONTROL_PREFIX = '00';

/** N° de factura impreso: entero con ceros a la izquierda. */
export function formatInvoiceNumber(n: number): string {
  return String(Math.trunc(n)).padStart(INVOICE_NUMBER_PAD, '0');
}

/**
 * N° de control DERIVADO del de factura: mismo número + 50, con la misma
 * cantidad de dígitos y dos ceros delante. `04912` → `0004962`.
 */
export function deriveControlNumber(n: number): string {
  return (
    INVOICE_CONTROL_PREFIX + formatInvoiceNumber(Math.trunc(n) + INVOICE_CONTROL_OFFSET)
  );
}

/**
 * Clave `providerType:providerId:specialtyId` de una fila ST. Sirve para saber
 * si el par proveedor↔especialidad ya estaba persistido en la orden (ver
 * `grandfatheredProviderSpecialties` en `validateCoreReferences`).
 */
function providerSpecialtyKey(row: {
  providerType: 'doctor' | 'care_center';
  doctorId?: string | null;
  careCenterId?: string | null;
  specialtyId?: string | null;
}): string {
  const pid =
    row.providerType === 'doctor' ? row.doctorId : row.careCenterId;
  return `${row.providerType}:${pid ?? ''}:${row.specialtyId ?? ''}`;
}

/**
 * Tope defensivo del número de orden elegido en el Paso 1. El campo acepta
 * cualquier entero libre; este techo sólo evita valores absurdos (la columna es
 * varchar y los números se comparan como bigint).
 */
const MAX_ORDER_NUMBER = 999_999_999;

/**
 * Banda de números TEMPORALES usada al renumerar una orden (ver
 * `OrdersService.renumberOrder`). Está por encima de {@link MAX_ORDER_NUMBER}
 * (ningún número real puede caer ahí) y por debajo de 2^31 para no romper el
 * índice de `order_internal_orders."internalNumber"` que castea a entero.
 */
const RENUMBER_TEMP_BASE = 1_500_000_000;

/** Etiquetas ES de tipos de pago para el historial de cambios. Espejo del FE. */
const PAYMENT_TYPE_LABEL_ES: Record<string, string> = {
  mobile_payment: 'Pago móvil',
  bank_transfer: 'Transferencia',
  bank_transfer_usd: 'Transferencia en dólares',
  card: 'Punto (tarjeta)',
  cash_usd: 'Efectivo dólares',
  cash_eur: 'Efectivo euros',
  cash_bs: 'Efectivo bolívares',
  other: 'Otro',
};

/** Resumen legible de un pago para el historial ("Pago móvil · 100.00 BS"). */
function paymentSummary(p: {
  type: string;
  amountValue: string | number;
  amountCurrency: string;
}): string {
  const label = PAYMENT_TYPE_LABEL_ES[p.type] ?? p.type;
  return `${label} · ${Number(p.amountValue).toFixed(2)} ${p.amountCurrency}`;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @InjectRepository(OrderPayment)
    private readonly paymentsRepo: Repository<OrderPayment>,
    @InjectRepository(OrderServiceType)
    private readonly ostRepo: Repository<OrderServiceType>,
    @InjectRepository(Patient)
    private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    @InjectRepository(CareCenter)
    private readonly careCentersRepo: Repository<CareCenter>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(ServiceType)
    private readonly serviceTypesRepo: Repository<ServiceType>,
    @InjectRepository(Pathology)
    private readonly pathologiesRepo: Repository<Pathology>,
    @InjectRepository(Specialty)
    private readonly specialtiesRepo: Repository<Specialty>,
    @InjectRepository(InsuranceServicePrice)
    private readonly insurancePricesRepo: Repository<InsuranceServicePrice>,
    @InjectRepository(DoctorServicePrice)
    private readonly doctorPricesRepo: Repository<DoctorServicePrice>,
    @InjectRepository(CareCenterServicePrice)
    private readonly careCenterPricesRepo: Repository<CareCenterServicePrice>,
    @InjectRepository(OrderServicePricing)
    private readonly orderPricingRepo: Repository<OrderServicePricing>,
    @InjectRepository(OrderProviderReport)
    private readonly providerReportsRepo: Repository<OrderProviderReport>,
    @InjectRepository(OrderChangeLog)
    private readonly changeLogsRepo: Repository<OrderChangeLog>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly appConfig: AppConfigService,
    private readonly paymentAccounts: PaymentAccountsService,
    private readonly providerAccounts: ProviderAccountsService,
  ) {
    void this.orderPricingRepo;
    void this.ostRepo;
    void this.banksRepo;
  }

  async onModuleInit(): Promise<void> {
    await this.bumpSequence('orders_seq', 'ORDER_NUMBER_START');
    await this.bumpSequence('accounts_payable_seq', 'PAYABLE_NUMBER_START');
    await this.bumpSequence(
      'accounts_receivable_seq',
      'RECEIVABLE_NUMBER_START',
    );
    await this.bumpSequence('taxes_payable_seq', 'TAX_PAYABLE_NUMBER_START');
    await this.bumpSequence('tax_payment_batch_seq', 'TAX_BATCH_NUMBER_START');
  }

  private userHasPermission(user: AuthenticatedUser, perm: string): boolean {
    if (user.isSuperAdmin) return true;
    return (user.permissions ?? []).includes(perm);
  }

  // ----- Historial de cambios por usuario -----

  /**
   * Registra una acción en el historial de la orden. Con `mgr` participa en la
   * transacción del caller; sin él inserta directo. Nunca lanza: un fallo de
   * bitácora no debe tumbar la operación principal.
   */
  private async logChange(
    mgr: EntityManager | null,
    orderId: string,
    userId: string,
    action: OrderChangeAction,
    changes?: Record<string, { from?: unknown; to?: unknown }> | null,
  ): Promise<void> {
    try {
      const row = { orderId, userId, action, changes: changes ?? null };
      if (mgr) await mgr.insert(OrderChangeLog, row);
      else await this.changeLogsRepo.insert(row);
    } catch (e) {
      this.logger.warn(
        `No se pudo registrar el historial (${action}, orden ${orderId}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * El Paso 1 (datos de la orden, monto y pagos) solo lo modifica el usuario
   * que creó la orden. Super Admin siempre pasa. Los demás pasos (atención,
   * informe, facturación) no tienen esta restricción.
   */
  private assertStep1Editable(order: Order, user: AuthenticatedUser): void {
    if (user.isSuperAdmin) return;
    if (order.createdById !== user.id) {
      throw new ForbiddenException(
        'Solo el usuario que creó la orden puede modificar el Paso 1',
      );
    }
  }

  /** Historial de cambios de la orden (más reciente primero). */
  async history(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OrderChangeLog[]> {
    await this.findOne(id, user, true);
    return this.changeLogsRepo.find({
      where: { orderId: id },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Suma de precios de catálogo (USD) de las filas dadas: baremo del seguro
   * elegido cuando la orden es de seguro, precio Particular en el resto.
   * Multiplica por la cantidad de cada fila. Es el **monto base** de la orden;
   * la diferencia contra `priceAmount` es el descuento (negativo) o recargo
   * (positivo) del Paso 1.
   *
   * `complete=false` cuando algún ST no tiene precio de catálogo: el base es
   * incompleto y no se puede leer la diferencia como ajuste (espeja el aviso
   * "Sin precio definido" del FE).
   */
  private async computeCatalogSum(
    type: 'cash' | 'credit' | 'insurance' | 'cashea',
    insuranceId: string | null | undefined,
    rows: Array<{ serviceTypeId: string; quantity?: number }>,
  ): Promise<{ sum: number; complete: boolean }> {
    if (!rows.length) return { sum: 0, complete: false };
    const ids = Array.from(new Set(rows.map((r) => r.serviceTypeId)));
    const unitByST = new Map<string, number>();
    if (type === 'insurance' && insuranceId) {
      const prices = await this.insurancePricesRepo.find({
        where: { insuranceId, serviceTypeId: In(ids) },
      });
      for (const p of prices) {
        const n = Number(p.priceUsd);
        if (Number.isFinite(n)) unitByST.set(p.serviceTypeId, n);
      }
    } else {
      const sts = await this.serviceTypesRepo.find({
        where: { id: In(ids) },
        select: ['id', 'particularPriceUsd'],
      });
      for (const st of sts) {
        if (st.particularPriceUsd == null) continue;
        const n = Number(st.particularPriceUsd);
        if (Number.isFinite(n)) unitByST.set(st.id, n);
      }
    }
    let cents = 0;
    let complete = true;
    for (const r of rows) {
      const unit = unitByST.get(r.serviceTypeId);
      if (unit == null) {
        complete = false;
        continue;
      }
      // Todo ST tiene cantidad (≥1, default 1).
      const qty = Math.max(1, Math.trunc(r.quantity ?? 1));
      cents += Math.round(unit * 100) * qty;
    }
    return { sum: cents / 100, complete };
  }

  /**
   * Ajuste de monto del Paso 1 — monto efectivo + trazabilidad.
   *
   * El monto base es la suma de precios de catálogo (baremo del seguro o
   * Particular). El usuario con `orders.edit-amount` puede guardar un monto
   * distinto (descuento o recargo) y en ese caso el **motivo es obligatorio**:
   * se persiste junto a quién lo aplicó y cuándo. Sin el permiso el monto se
   * fuerza al base, salvo que un validador ya haya autorizado uno (su decisión
   * no se pisa, ver `authorizeAmount`).
   */
  private async resolvePriceAdjustment(
    args: {
      type: 'cash' | 'credit' | 'insurance' | 'cashea';
      insuranceId: string | null | undefined;
      rows: Array<{ serviceTypeId: string; quantity?: number }>;
      requestedAmount: number;
      note?: string | null;
      /** Orden existente en `update`; undefined al crear. */
      existing?: Order | null;
    },
    user: AuthenticatedUser,
  ): Promise<{
    priceAmount: number;
    priceBaseAmount: string;
    priceAdjustmentNote: string | null;
    priceAdjustedById: string | null;
    priceAdjustedAt: Date | null;
  }> {
    const { type, insuranceId, rows, requestedAmount, existing } = args;
    const { sum: base, complete } = await this.computeCatalogSum(
      type,
      insuranceId,
      rows,
    );
    const canEditAmount = this.userHasPermission(
      user,
      PERMISSIONS.ORDERS.EDIT_AMOUNT,
    );

    let amount = requestedAmount;
    if (!canEditAmount) {
      amount = existing?.amountAuthorizedById
        ? Number(existing.priceAmount)
        : base;
    }

    // Catálogo incompleto (algún ST sin precio): el base no es comparable, así
    // que se guarda igual al monto y no se registra ajuste.
    if (!complete) {
      return {
        priceAmount: amount,
        priceBaseAmount: amount.toFixed(2),
        priceAdjustmentNote: null,
        priceAdjustedById: null,
        priceAdjustedAt: null,
      };
    }

    const noAdjustment = {
      priceAmount: base,
      priceBaseAmount: base.toFixed(2),
      priceAdjustmentNote: null,
      priceAdjustedById: null,
      priceAdjustedAt: null,
    };
    if (Math.round(amount * 100) === Math.round(base * 100))
      return noAdjustment;

    // Sin permiso para editar el monto tampoco se acepta un motivo nuevo: el
    // rastro del monto autorizado por el validador se conserva tal cual.
    const note = canEditAmount ? (args.note ?? '').trim() : '';
    const sameAmount =
      !!existing &&
      Math.round(Number(existing.priceAmount) * 100) ===
        Math.round(amount * 100);
    if (note) {
      // Mismo monto y mismo motivo ⇒ conserva autor/fecha originales (guardar el
      // borrador de nuevo no re-estampa el ajuste).
      const keepTrail =
        sameAmount &&
        !!existing?.priceAdjustedById &&
        (existing.priceAdjustmentNote ?? '').trim() === note;
      return {
        priceAmount: amount,
        priceBaseAmount: base.toFixed(2),
        priceAdjustmentNote: note,
        priceAdjustedById: keepTrail
          ? (existing.priceAdjustedById as string)
          : user.id,
        priceAdjustedAt: keepTrail
          ? (existing.priceAdjustedAt ?? null)
          : new Date(),
      };
    }

    // Sin motivo nuevo: sólo se acepta si el monto no cambió y ya hay una
    // justificación previa (ajuste anterior o autorización de un validador).
    if (sameAmount && existing?.priceAdjustmentNote) {
      return {
        priceAmount: amount,
        priceBaseAmount: base.toFixed(2),
        priceAdjustmentNote: existing.priceAdjustmentNote,
        priceAdjustedById: existing.priceAdjustedById ?? null,
        priceAdjustedAt: existing.priceAdjustedAt ?? null,
      };
    }
    if (sameAmount && existing?.amountAuthorizedById) {
      return {
        priceAmount: amount,
        priceBaseAmount: base.toFixed(2),
        priceAdjustmentNote: existing.amountAuthorizationNote ?? null,
        priceAdjustedById: existing.amountAuthorizedById,
        priceAdjustedAt: existing.amountAuthorizedAt ?? null,
      };
    }
    throw new BadRequestException(
      'Indica el motivo del ajuste de monto: el monto difiere de la suma de los precios de catálogo',
    );
  }

  private async bumpSequence(seq: string, envKey: string): Promise<void> {
    const raw = this.config.get<string>(envKey);
    const start = raw ? Number(raw) : 1;
    if (!Number.isFinite(start) || start <= 1) return;
    try {
      const rows = await this.dataSource.query<
        { last_value: string; is_called: boolean }[]
      >(`SELECT last_value, is_called FROM ${seq}`);
      const lastValue = rows[0] ? Number(rows[0].last_value) : 0;
      const isCalled = rows[0]?.is_called ?? false;
      const nextWouldBe = isCalled ? lastValue + 1 : lastValue;
      if (nextWouldBe >= start) return;
      await this.dataSource.query(`SELECT setval('${seq}', $1, true)`, [
        start - 1,
      ]);
      this.logger.log(`${seq} bumped: próximo número = ${start}`);
    } catch (e) {
      this.logger.warn(
        `No se pudo inicializar ${seq} desde ${envKey}: ${(e as Error).message}`,
      );
    }
  }

  private async resolveUserBranchIds(
    user: AuthenticatedUser,
  ): Promise<string[]> {
    if (user.isSuperAdmin) {
      const all = await this.branchesRepo.find({
        where: { isActive: true, deletedAt: IsNull() },
        select: ['id'],
      });
      return all.map((b) => b.id);
    }
    const u = await this.dataSource
      .createQueryBuilder()
      .select('b.id', 'id')
      .from('user_branches', 'ub')
      .innerJoin('branches', 'b', 'b.id = ub."branchId"')
      .where('ub."userId" = :uid', { uid: user.id })
      .andWhere('b."isActive" = true')
      .andWhere('b."deletedAt" IS NULL')
      .getRawMany<{ id: string }>();
    return u.map((r) => r.id);
  }

  /** Piso de numeración de órdenes: `ORDER_NUMBER_START` (def 1). */
  private orderNumberFloor(): number {
    const raw = this.config.get<string>('ORDER_NUMBER_START');
    const start = raw ? Number(raw) : 1;
    if (!Number.isFinite(start) || start < 1) return 1;
    return Math.trunc(start);
  }

  /**
   * Asigna `n` números de orden interna dentro de la transacción dada. Cada
   * proveedor distinto de una orden consume uno; el primero es además el número
   * BASE de la orden (`orders.orderNumber`).
   *
   * Tres modos:
   *  - `base` (número elegido a mano en el Paso 1): bloque CONSECUTIVO
   *    `[base, base + n - 1]`. Los `n` números deben estar libres; si alguno
   *    está en uso se rechaza diciendo cuáles (nunca se reasigna en silencio).
   *  - `from` (proveedor agregado a una orden ya numerada): los `n` menores
   *    números LIBRES ≥ `from`, para que las órdenes internas de una misma
   *    orden queden contiguas y se rellenen sus propios huecos.
   *  - sin opciones (numeración automática): `n` consecutivos desde la marca de
   *    agua (`orders_seq`), que sólo avanza — esos números no se reutilizan.
   *
   * "En uso" = en manos de una orden VIVA. Una orden CANCELADA conserva su
   * número impreso pero lo libera (los UNIQUE son parciales, ver la migración
   * `ReuseCancelledOrderNumbers`), así que se puede volver a elegir a mano. La
   * numeración automática igual lo salta: su marca de agua cuenta las
   * canceladas.
   *
   * `excludeOrderId` ignora los números que ya tiene la propia orden (usado al
   * renumerar).
   *
   * Concurrencia: lock de aplicación por transacción (`pg_advisory_xact_lock`)
   * serializa la asignación; además `internalNumber`/`orderNumber` son UNIQUE.
   */
  private async drawOrderNumbers(
    mgr: EntityManager,
    n: number,
    opts?: { base?: number; from?: number; excludeOrderId?: string },
  ): Promise<string[]> {
    if (n <= 0) return [];
    // Serializa la asignación entre transacciones concurrentes.
    await mgr.query("SELECT pg_advisory_xact_lock(hashtext('orders_seq'))");
    if (opts?.base != null) {
      return this.drawBlockFrom(mgr, opts.base, n, opts.excludeOrderId);
    }
    if (opts?.from != null) {
      return this.drawFirstFreeFrom(mgr, opts.from, n, opts.excludeOrderId);
    }
    return this.drawAutoOrderNumbers(mgr, n);
  }

  /**
   * Números del bloque `[base, base + n - 1]` en manos de órdenes VIVAS (no
   * canceladas), sea como número base de una orden o como orden interna: los
   * que NO se pueden volver a usar. Cuenta también las órdenes en papelera
   * (conservan su número porque son restaurables) y NO cuenta las canceladas
   * (su número queda libre para reutilizarlo a mano).
   */
  private async takenInBlock(
    mgr: EntityManager,
    base: number,
    n: number,
    excludeOrderId?: string,
  ): Promise<number[]> {
    return this.numbersInBlock(mgr, base, n, excludeOrderId, false);
  }

  /**
   * Números del bloque que sólo tiene alguna orden CANCELADA. Están libres (se
   * pueden reutilizar), pero siguen impresos en esa orden: se devuelven aparte
   * para que el Paso 1 lo avise.
   */
  private async cancelledInBlock(
    mgr: EntityManager,
    base: number,
    n: number,
    excludeOrderId?: string,
  ): Promise<number[]> {
    return this.numbersInBlock(mgr, base, n, excludeOrderId, true);
  }

  /**
   * Números del bloque `[base, base + n - 1]` en uso por órdenes canceladas
   * (`cancelled = true`) o por órdenes vivas (`false`). Los UNIQUE de
   * `internalNumber`/`orderNumber` son parciales sobre las vivas, así que sólo
   * esas bloquean la asignación.
   */
  private async numbersInBlock(
    mgr: EntityManager,
    base: number,
    n: number,
    excludeOrderId: string | undefined,
    cancelled: boolean,
  ): Promise<number[]> {
    const rows = await mgr.query<{ n: string }[]>(
      `WITH block AS (
         SELECT generate_series($1::bigint, $1::bigint + $2::bigint - 1) AS n
       )
       SELECT b.n::text AS n
         FROM block b
        WHERE EXISTS (
                SELECT 1 FROM "order_internal_orders" iio
                 WHERE iio."internalNumber" = b.n::text
                   AND iio."cancelled" = $4::boolean
                   AND ($3::uuid IS NULL OR iio."orderId" <> $3::uuid)
              )
           OR EXISTS (
                SELECT 1 FROM "orders" o
                 WHERE o."orderNumber" = b.n::text
                   AND (o.status = 'cancelled') = $4::boolean
                   AND ($3::uuid IS NULL OR o.id <> $3::uuid)
              )
        ORDER BY b.n`,
      [String(base), String(n), excludeOrderId ?? null, cancelled],
    );
    return rows.map((r) => Number(r.n));
  }

  /**
   * Bloque consecutivo desde un número elegido a mano. Todos los números del
   * bloque deben estar libres: una orden con K proveedores ocupa
   * `[base, base + K - 1]`. Sube la marca de agua para que la numeración
   * automática no vuelva a entregar esos números.
   */
  private async drawBlockFrom(
    mgr: EntityManager,
    base: number,
    n: number,
    excludeOrderId?: string,
  ): Promise<string[]> {
    const start = this.assertOrderNumberRange(base);
    const taken = await this.takenInBlock(mgr, start, n, excludeOrderId);
    if (taken.length) {
      throw new BadRequestException(
        n === 1
          ? `El número de orden ${taken[0]} ya está en uso`
          : `La orden necesita ${n} números consecutivos desde ${start} (uno por proveedor) y ya están en uso: ${taken.join(', ')}`,
      );
    }
    await this.advanceSequenceTo(mgr, start + n - 1);
    return Array.from({ length: n }, (_, i) => String(start + i));
  }

  /**
   * Los `n` menores números LIBRES ≥ `from` (rellena huecos). Lo usa el
   * proveedor que se agrega a una orden ya numerada, para que sus órdenes
   * internas queden lo más contiguas posible al número base.
   */
  private async drawFirstFreeFrom(
    mgr: EntityManager,
    from: number,
    n: number,
    excludeOrderId?: string,
  ): Promise<string[]> {
    const start = this.assertOrderNumberRange(from);
    const rows = await mgr.query<{ n: string }[]>(
      `WITH taken AS (
         SELECT "internalNumber"::bigint AS n
           FROM "order_internal_orders"
          WHERE "internalNumber" ~ '^[0-9]+$'
            AND "cancelled" = false
            AND "internalNumber"::bigint >= $1::bigint
            AND ($3::uuid IS NULL OR "orderId" <> $3::uuid)
         UNION
         SELECT "orderNumber"::bigint
           FROM "orders"
          WHERE "orderNumber" ~ '^[0-9]+$'
            AND status <> 'cancelled'
            AND "orderNumber"::bigint >= $1::bigint
            AND ($3::uuid IS NULL OR id <> $3::uuid)
       ),
       hi AS (SELECT COALESCE(MAX(n), $1::bigint - 1) AS v FROM taken)
       SELECT g AS n
         FROM generate_series($1::bigint, (SELECT v FROM hi) + $2::bigint) AS g
        WHERE NOT EXISTS (SELECT 1 FROM taken t WHERE t.n = g)
        ORDER BY g
        LIMIT $2`,
      [String(start), String(n), excludeOrderId ?? null],
    );
    if (rows.length < n) {
      throw new BadRequestException(
        `No hay suficientes números libres desde ${start} para todos los proveedores de la orden`,
      );
    }
    const numbers = rows.map((r) => Number(r.n));
    await this.advanceSequenceTo(mgr, Math.max(...numbers));
    return numbers.map((v) => String(v));
  }

  /** Sube la marca de agua de `orders_seq` hasta `value`. Nunca la baja. */
  private async advanceSequenceTo(
    mgr: EntityManager,
    value: number,
  ): Promise<void> {
    await mgr.query(
      `SELECT setval('orders_seq', GREATEST(
         (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END
            FROM orders_seq),
         $1::bigint
       ), true)`,
      [String(Math.max(1, Math.trunc(value)))],
    );
  }

  /**
   * Rango automático: `n` números CONSECUTIVOS desde la marca de agua. Nunca
   * mira los huecos. El `setval` final deja la marca en el último entregado:
   * sólo avanza, nunca retrocede al borrar.
   */
  private async drawAutoOrderNumbers(
    mgr: EntityManager,
    n: number,
  ): Promise<string[]> {
    const start = await this.nextAutoNumber(mgr);
    // `setval` no es transaccional: si la creación falla después, el número
    // queda quemado (hueco) en vez de reasignarse a otra orden.
    await mgr.query(`SELECT setval('orders_seq', $1::bigint, true)`, [
      String(start + n - 1),
    ]);
    return Array.from({ length: n }, (_, i) => String(start + i));
  }

  /**
   * Próximo número que entregaría la numeración automática = "el mayor + 1":
   * mayor entre la marca de agua de `orders_seq`, el mayor número en uso + 1 y
   * el piso del env (cubre secuencias atrasadas o restauraciones de BD). Es el
   * valor que el Paso 1 propone por defecto.
   *
   * A propósito cuenta también las órdenes CANCELADAS: aunque su número esté
   * libre para reutilizarlo A MANO, el rango automático nunca lo reparte (así
   * no aparece de sorpresa un número que otra orden todavía muestra).
   */
  private async nextAutoNumber(mgr?: EntityManager): Promise<number> {
    const runner = mgr ?? this.dataSource.manager;
    const rows = await runner.query<{ next: string }[]>(
      `SELECT GREATEST(
         (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
            FROM orders_seq),
         (SELECT COALESCE(MAX("internalNumber"::bigint), 0) + 1
            FROM "order_internal_orders" WHERE "internalNumber" ~ '^[0-9]+$'),
         (SELECT COALESCE(MAX("orderNumber"::bigint), 0) + 1
            FROM "orders" WHERE "orderNumber" ~ '^[0-9]+$'),
         $1::bigint
       )::text AS next`,
      [String(this.orderNumberFloor())],
    );
    const next = Number(rows[0]?.next);
    if (!Number.isFinite(next)) {
      throw new BadRequestException('No se pudieron asignar números de orden');
    }
    return next;
  }

  /**
   * Rango válido de un número de orden (sin tocar la BD): entero entre 1 y
   * `MAX_ORDER_NUMBER`. Ya no hay tope por `ORDER_NUMBER_START`: el Paso 1 puede
   * fijar cualquier número libre (el env es sólo el piso de la numeración
   * automática). Se chequea antes de abrir la transacción para dar el error
   * exacto y no arrastrar un valor imposible al reparto de números.
   */
  private assertOrderNumberRange(value: number): number {
    const n = Math.trunc(value);
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException(
        'El número de orden debe ser mayor o igual a 1',
      );
    }
    if (n > MAX_ORDER_NUMBER) {
      throw new BadRequestException(
        `El número de orden no puede superar ${MAX_ORDER_NUMBER}`,
      );
    }
    return n;
  }

  /**
   * Disponibilidad de un número de orden para el Paso 1. `count` = cantidad de
   * proveedores distintos de la orden: cada uno consume un número consecutivo
   * (las órdenes internas del Paso 2), así que se consulta el BLOQUE completo.
   *
   *  - `suggestion`: número por defecto = el mayor en uso + 1.
   *  - `taken`: números del bloque que ya están ocupados por órdenes vivas.
   *  - `cancelled`: números del bloque libres porque su orden fue CANCELADA
   *    (se pueden reutilizar; el Paso 1 lo avisa).
   *  - `nextFree`: primer número ≥ el pedido cuyo bloque completo está libre
   *    (cae en `suggestion` si no hay hueco cerca).
   *
   * `orderId` excluye los números que ya tiene esa orden (renumerar un borrador).
   */
  async numberAvailability(opts: {
    number?: number;
    count?: number;
    orderId?: string;
  }): Promise<{
    count: number;
    suggestion: number;
    number: number | null;
    available: boolean | null;
    taken: number[];
    cancelled: number[];
    nextFree: number;
  }> {
    const count = Math.min(Math.max(Math.trunc(opts.count ?? 1) || 1, 1), 50);
    const suggestion = await this.nextAutoNumber();
    if (opts.number == null) {
      return {
        count,
        suggestion,
        number: null,
        available: null,
        taken: [],
        cancelled: [],
        nextFree: suggestion,
      };
    }
    const number = this.assertOrderNumberRange(opts.number);
    const taken = await this.takenInBlock(
      this.dataSource.manager,
      number,
      count,
      opts.orderId,
    );
    const available = taken.length === 0;
    // Números que sólo tiene una orden cancelada: libres, pero conviene avisar
    // que ya se imprimieron en esa orden.
    const cancelled = (
      await this.cancelledInBlock(
        this.dataSource.manager,
        number,
        count,
        opts.orderId,
      )
    ).filter((n) => !taken.includes(n));
    return {
      count,
      suggestion,
      number,
      available,
      taken,
      cancelled,
      nextFree: available
        ? number
        : await this.firstFreeBlock(number, count, opts.orderId, suggestion),
    };
  }

  /**
   * La clave de servicio (autorización del seguro) no se repite entre órdenes
   * vivas y NO se reutiliza: sólo vuelve a quedar libre si la orden que la
   * tenía fue cancelada (misma regla que el N° de orden).
   *
   * **La regla es de aplicación, no de base de datos**: no hay índice único
   * (los datos históricos ya traen claves repetidas y un UNIQUE dejaría esas
   * órdenes sin poder editarse). Por eso sólo se valida cuando la clave se
   * está escribiendo o cambiando — create, y update con clave distinta a la
   * guardada. Las órdenes viejas duplicadas quedan grandfathered.
   */
  private async assertServiceKeyAvailable(
    mgr: EntityManager,
    serviceKey: string | null,
    excludeOrderId?: string,
  ): Promise<void> {
    if (!serviceKey) return;
    const rows = await mgr.query<{ orderNumber: string }[]>(
      `SELECT "orderNumber" FROM "orders"
        WHERE "serviceKey" = $1
          AND "status" <> 'cancelled'
          AND ($2::uuid IS NULL OR id <> $2::uuid)
        LIMIT 1`,
      [serviceKey, excludeOrderId ?? null],
    );
    if (rows.length) {
      throw new BadRequestException(
        `La clave de servicio "${serviceKey}" ya está en uso por la orden N° ${rows[0].orderNumber}. Sólo queda libre si esa orden se cancela.`,
      );
    }
  }

  /**
   * Disponibilidad de una clave de servicio (feedback en vivo del Paso 1).
   * `cancelled: true` = está libre porque su orden fue cancelada (ya se
   * imprimió en esa orden).
   */
  async serviceKeyAvailability(opts: { key?: string; orderId?: string }): Promise<{
    key: string | null;
    available: boolean | null;
    usedByOrderNumber: string | null;
    cancelled: boolean;
  }> {
    const key = (opts.key ?? '').trim();
    if (!key) {
      return { key: null, available: null, usedByOrderNumber: null, cancelled: false };
    }
    const rows = await this.dataSource.manager.query<
      { orderNumber: string; status: string }[]
    >(
      `SELECT "orderNumber", "status" FROM "orders"
        WHERE "serviceKey" = $1
          AND ($2::uuid IS NULL OR id <> $2::uuid)
        ORDER BY ("status" <> 'cancelled') DESC
        LIMIT 1`,
      [key, opts.orderId ?? null],
    );
    const row = rows[0];
    const taken = !!row && row.status !== 'cancelled';
    return {
      key,
      available: !taken,
      usedByOrderNumber: row ? row.orderNumber : null,
      cancelled: !!row && row.status === 'cancelled',
    };
  }

  /**
   * Primer número ≥ `from` cuyo bloque de `count` números consecutivos está
   * completamente libre, buscando en una ventana acotada. Sin hueco en la
   * ventana devuelve `fallback` (el número automático).
   */
  private async firstFreeBlock(
    from: number,
    count: number,
    excludeOrderId: string | undefined,
    fallback: number,
  ): Promise<number> {
    const WINDOW = 5000;
    const rows = await this.dataSource.query<{ n: string }[]>(
      `SELECT n FROM (
         SELECT "internalNumber"::bigint AS n
           FROM "order_internal_orders"
          WHERE "internalNumber" ~ '^[0-9]+$'
            AND "cancelled" = false
            AND ($3::uuid IS NULL OR "orderId" <> $3::uuid)
         UNION
         SELECT "orderNumber"::bigint
           FROM "orders"
          WHERE "orderNumber" ~ '^[0-9]+$'
            AND status <> 'cancelled'
            AND ($3::uuid IS NULL OR id <> $3::uuid)
       ) t
        WHERE n >= $1::bigint AND n < $1::bigint + $2::bigint`,
      [String(from), String(WINDOW), excludeOrderId ?? null],
    );
    const taken = new Set(rows.map((r) => Number(r.n)));
    for (let base = from; base + count - 1 < from + WINDOW; base += 1) {
      let free = true;
      for (let i = 0; i < count; i += 1) {
        if (taken.has(base + i)) {
          free = false;
          break;
        }
      }
      if (free) return base;
    }
    return fallback;
  }

  /**
   * Renumera por completo una orden en borrador: el número dado pasa a ser el
   * BASE y los proveedores toman el bloque consecutivo que arranca ahí.
   *
   * Primero aparca los números actuales de la orden en la banda temporal
   * ({@link RENUMBER_TEMP_BASE}), para que reasignar un número entre proveedores
   * de la misma orden no choque con el UNIQUE de `internalNumber`. Los temporales
   * son NUMÉRICOS a propósito: `order_internal_orders."internalNumber"` tiene un
   * índice por expresión que castea el valor, así que un texto no numérico
   * revienta el UPDATE. El lock se toma ANTES de escribirlos para que dos
   * renumeraciones concurrentes no peleen por la misma banda.
   */
  private async renumberOrder(
    mgr: EntityManager,
    orderId: string,
    base: number,
  ): Promise<void> {
    await mgr.query("SELECT pg_advisory_xact_lock(hashtext('orders_seq'))");
    const rows = await mgr.query<Array<{ id: string }>>(
      `SELECT id FROM "order_internal_orders"
        WHERE "orderId" = $1 ORDER BY "sequencePosition"`,
      [orderId],
    );
    for (let i = 0; i < rows.length; i += 1) {
      await mgr.query(
        `UPDATE "order_internal_orders" SET "internalNumber" = $1 WHERE id = $2`,
        [String(RENUMBER_TEMP_BASE + i), rows[i].id],
      );
    }
    await mgr.query(`UPDATE "orders" SET "orderNumber" = $1 WHERE id = $2`, [
      String(RENUMBER_TEMP_BASE + rows.length),
      orderId,
    ]);
    const numbers = await this.drawOrderNumbers(mgr, Math.max(1, rows.length), {
      base,
      excludeOrderId: orderId,
    });
    for (let i = 0; i < rows.length; i += 1) {
      await mgr.query(
        `UPDATE "order_internal_orders" SET "internalNumber" = $1 WHERE id = $2`,
        [numbers[i], rows[i].id],
      );
    }
    await mgr.query(`UPDATE "orders" SET "orderNumber" = $1 WHERE id = $2`, [
      numbers[0],
      orderId,
    ]);
  }

  /** Número desde el cual el sistema asigna automáticamente (`ORDER_NUMBER_START`). */
  orderNumberStart(): { start: number } {
    return { start: this.orderNumberFloor() };
  }

  private orderRelations() {
    return {
      branch: true,
      holder: { phones: true },
      patient: { phones: true },
      contractor: true,
      insurance: { phones: true },
      specialty: true,
      orderServiceTypes: {
        serviceType: true,
        specialty: true,
        doctor: true,
        careCenter: true,
        internalOrder: true,
      },
      internalOrders: true,
      pathologies: true,
      createdBy: true,
      amountAuthorizedBy: true,
      priceAdjustedBy: true,
      cancelledBy: true,
      payments: { exchangeRate: true },
      billingExchangeRate: true,
      invoiceExchangeRate: true,
      fixedExchangeRate: true,
      servicePricing: true,
      providerReports: { doctor: true, careCenter: true },
    } as const;
  }

  /** Resuelve el proveedor vinculado al usuario (o null si es staff/super admin). */
  private async resolveProvider(
    user: AuthenticatedUser,
  ): Promise<ProviderLink | null> {
    if (user.isSuperAdmin) return null;
    return this.providerAccounts.findProviderByUserId(user.id);
  }

  /** ¿La orden (cargada con orderServiceTypes) incluye al proveedor dado? */
  private orderHasProvider(order: Order, provider: ProviderLink): boolean {
    return (order.orderServiceTypes ?? []).some((ost) =>
      provider.type === 'doctor'
        ? ost.doctorId === provider.id
        : ost.careCenterId === provider.id,
    );
  }

  async findAll(
    query: QueryOrdersDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Order>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      branchId,
      doctorId,
      careCenterId,
      specialtyId,
      orderDateFrom,
      orderDateTo,
      appointmentDateFrom,
      appointmentDateTo,
      // El listado ordena por N° de orden por defecto (no por fecha de creación).
      sortBy = 'orderNumber',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
    } = query;

    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.branch', 'branch')
      .leftJoinAndSelect('o.holder', 'holder')
      .leftJoinAndSelect('holder.phones', 'holderPhones')
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('patient.phones', 'patientPhones')
      .leftJoinAndSelect('o.specialty', 'specialty')
      .leftJoinAndSelect('o.orderServiceTypes', 'ost')
      .leftJoinAndSelect('ost.serviceType', 'serviceType')
      .leftJoinAndSelect('ost.doctor', 'ostDoctor')
      .leftJoinAndSelect('ost.careCenter', 'ostCareCenter')
      .leftJoinAndSelect('o.pathologies', 'pathology')
      .leftJoinAndSelect('o.contractor', 'contractor')
      .leftJoinAndSelect('o.insurance', 'insurance')
      .leftJoinAndSelect('insurance.phones', 'insurancePhones')
      // Órdenes internas (números por proveedor) para mostrar todos en el listado.
      .leftJoinAndSelect('o.internalOrders', 'orderInternalOrders')
      // Creador de la orden (columna "Creado por" del listado).
      .leftJoinAndSelect('o.createdBy', 'createdBy');

    // `orderNumber` es varchar: ordenar como texto pone 100 antes que 99. Se
    // ordena por su valor numérico (los no numéricos van al final). El orden va
    // por ALIAS de un addSelect, no por una expresión cruda: la paginación de
    // TypeORM (take/skip + DISTINCT sobre los ids) no sabe traducir expresiones.
    if (sortBy === 'orderNumber') {
      qb.addSelect(
        `CASE WHEN o."orderNumber" ~ '^[0-9]+$' THEN o."orderNumber"::bigint END`,
        'order_number_num',
      )
        .orderBy('order_number_num', sortDir, 'NULLS LAST')
        .addOrderBy('o.orderNumber', sortDir);
    } else {
      qb.orderBy(`o.${sortBy}`, sortDir);
    }

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('o.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    const provider = user.isSuperAdmin
      ? null
      : await this.resolveProvider(user);
    if (!user.isSuperAdmin) {
      if (provider) {
        // Usuario proveedor: solo sus órdenes (vía OST) y solo accionables.
        qb.andWhere(
          provider.type === 'doctor'
            ? 'EXISTS (SELECT 1 FROM order_service_types pst WHERE pst."orderId" = o.id AND pst."doctorId" = :pid)'
            : 'EXISTS (SELECT 1 FROM order_service_types pst WHERE pst."orderId" = o.id AND pst."careCenterId" = :pid)',
          { pid: provider.id },
        );
        qb.andWhere("o.status IN ('attended', 'report_issued', 'finalized')");
      } else {
        const allowed = await this.resolveUserBranchIds(user);
        if (allowed.length === 0) {
          qb.andWhere('1 = 0');
        } else {
          qb.andWhere('o.branchId IN (:...allowed)', { allowed });
        }
      }
    }

    if (branchId) qb.andWhere('o.branchId = :branchId', { branchId });
    if (status) qb.andWhere('o.status = :status', { status });
    if (type) qb.andWhere('o.type = :type', { type });
    // Filtros doctor/care_center ahora vía OST.
    if (doctorId)
      qb.andWhere(
        'EXISTS (SELECT 1 FROM order_service_types fst WHERE fst."orderId" = o.id AND fst."doctorId" = :doctorId)',
        { doctorId },
      );
    if (careCenterId)
      qb.andWhere(
        'EXISTS (SELECT 1 FROM order_service_types fst WHERE fst."orderId" = o.id AND fst."careCenterId" = :careCenterId)',
        { careCenterId },
      );
    // La especialidad vive por fila ST (una orden puede combinar varias), así
    // que el filtro busca cualquier fila con esa especialidad — no sólo la
    // principal (`o.specialtyId`), o las órdenes mixtas se perderían.
    if (specialtyId)
      qb.andWhere(
        `EXISTS (SELECT 1 FROM order_service_types sst
                  WHERE sst."orderId" = o.id AND sst."specialtyId" = :specialtyId)`,
        { specialtyId },
      );
    if (orderDateFrom)
      qb.andWhere('o.orderDate >= :odf', { odf: orderDateFrom });
    if (orderDateTo) qb.andWhere('o.orderDate <= :odt', { odt: orderDateTo });
    if (appointmentDateFrom)
      qb.andWhere('o.appointmentDate >= :adf', { adf: appointmentDateFrom });
    if (appointmentDateTo)
      qb.andWhere('o.appointmentDate <= :adt', { adt: appointmentDateTo });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(o."orderNumber") LIKE :s
          OR EXISTS (SELECT 1 FROM "order_internal_orders" iio WHERE iio."orderId" = o.id AND LOWER(iio."internalNumber") LIKE :s)
          OR LOWER(holder."firstName") LIKE :s
          OR LOWER(holder."lastName") LIKE :s
          OR LOWER(holder."businessName") LIKE :s
          OR LOWER(holder.cedula) LIKE :s
          OR LOWER(holder.rif) LIKE :s
          OR LOWER(patient."firstName") LIKE :s
          OR LOWER(patient."lastName") LIKE :s
          OR LOWER(patient."businessName") LIKE :s
          OR LOWER(patient.cedula) LIKE :s
          OR LOWER(patient.rif) LIKE :s)`,
        { s },
      );
    }

    const result = await paginateBuilder<Order>(qb, page, limit);

    // Usuario proveedor: marca si SU propia observación (Paso 3) está completa.
    // Completa = tiene un order_provider_report suyo con observations no vacío
    // O al menos un archivo suyo (kind por proveedor) adjunto a la orden.
    if (provider && result.data.length) {
      const ids = result.data.map((o) => o.id);
      const col = provider.type === 'doctor' ? 'doctorId' : 'careCenterId';
      const kind = orderReportProviderKind(provider.type, provider.id);
      const rows = await this.repo.manager.query<Array<{ orderId: string }>>(
        `SELECT t.id AS "orderId"
           FROM unnest($1::uuid[]) AS t(id)
          WHERE EXISTS (
                  SELECT 1 FROM "order_provider_reports" r
                   WHERE r."orderId" = t.id AND r."${col}" = $2
                     AND r."observations" IS NOT NULL AND btrim(r."observations") <> ''
                )
             OR EXISTS (
                  SELECT 1 FROM "files" f
                   WHERE f."ownerType" = 'order' AND f."ownerId" = t.id
                     AND f."kind" = $3 AND f."deletedAt" IS NULL
                )`,
        [ids, provider.id, kind],
      );
      const done = new Set(rows.map((r) => r.orderId));
      for (const o of result.data)
        o.providerObservationComplete = done.has(o.id);
    }

    return result;
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    withDeleted = false,
  ): Promise<Order> {
    const order = await this.repo.findOne({
      where: { id },
      relations: this.orderRelations(),
      // CRÍTICO: no auto-cargar relaciones `eager` anidadas (seguros/contratistas
      // del paciente, servicePrices de seguros/doctores/centros, etc.). Junto a las
      // relaciones to-many de la orden producen un PRODUCTO CARTESIANO que explota
      // la memoria (OOM) para pacientes con muchos seguros. La orden no las necesita.
      loadEagerRelations: false,
      withDeleted,
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    await this.assertOrderVisibility(order, user);
    order.invoices = await this.loadInvoices(order.id);
    return order;
  }

  /** Facturas de la orden (vigente + anuladas), más antigua primero. */
  private async loadInvoices(orderId: string): Promise<OrderInvoice[]> {
    return this.repo.manager.getRepository(OrderInvoice).find({
      where: { orderId },
      relations: { cancelledBy: true, createdBy: true, exchangeRate: true },
      loadEagerRelations: false,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Nombres personalizados ya usados para un Tipo de Servicio (para reutilizar
   * en el Paso 1 — autocompletar). Distintos, no vacíos, más recientes primero.
   */
  async customNameSuggestions(serviceTypeId: string): Promise<string[]> {
    const rows = await this.repo.manager
      .getRepository(OrderServiceType)
      .createQueryBuilder('ost')
      .innerJoin('ost.order', 'o')
      .select('ost.customName', 'customName')
      .addSelect('MAX(ost.updatedAt)', 'last')
      .where('ost.serviceTypeId = :id', { id: serviceTypeId })
      .andWhere('ost.customName IS NOT NULL')
      .andWhere("TRIM(ost.customName) <> ''")
      .andWhere('o.deletedAt IS NULL')
      .groupBy('ost.customName')
      .orderBy('last', 'DESC')
      .limit(50)
      .getRawMany<{ customName: string }>();
    return rows.map((r) => r.customName).filter((n): n is string => !!n);
  }

  /**
   * Visibilidad de una orden ya cargada (con `orderServiceTypes`).
   *  - Super Admin: siempre.
   *  - Usuario proveedor: solo si participa en la orden (vía OST).
   *  - Staff: por sucursal asignada.
   */
  private async assertOrderVisibility(
    order: Order,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const provider = await this.resolveProvider(user);
    if (provider) {
      if (!this.orderHasProvider(order, provider)) {
        throw new ForbiddenException('No tienes acceso a esta orden');
      }
      return;
    }
    await this.assertBranchVisibility(order.branchId, user);
  }

  private async assertBranchVisibility(
    branchId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(branchId)) {
      throw new ForbiddenException('No tienes acceso a esta sucursal');
    }
  }

  /**
   * Valida referencias core. Provider validation per ST row: cada fila debe
   * tener exactamente uno de doctorId/careCenterId coherente con providerType,
   * y el proveedor debe tener la especialidad de ESA fila (una orden puede
   * combinar especialidades: ej. laboratorio en un centro + rayos X en otro).
   */
  private async validateCoreReferences(
    dto: Partial<CreateOrderDto>,
    user: AuthenticatedUser,
    opts?: {
      /**
       * Pares `providerType:providerId:specialtyId` ya persistidos en la orden.
       * Se les perdona la validación proveedor↔especialidad: las órdenes creadas
       * antes de la especialidad por fila heredaron la principal de la orden sin
       * que nadie chequeara que el proveedor la tuviera asignada, y editar otra
       * cosa del Paso 1 (fecha, monto, pagos) no debe quedar bloqueado por eso.
       * Un par NUEVO o CAMBIADO sí se valida.
       */
      grandfatheredProviderSpecialties?: Set<string>;
    },
  ): Promise<{ holder: Patient }> {
    if (!dto.branchId) throw new BadRequestException('branchId requerido');
    await this.assertBranchVisibility(dto.branchId, user);

    const holder = await this.patientsRepo.findOne({
      where: { id: dto.holderId!, deletedAt: IsNull() },
      relations: { contractors: { insurances: true }, insurances: true },
      // Sólo se validan IDs de seguros/contratistas del titular. Sin eager: el
      // eager de Patient duplica el join de `insurances` (explícito + eager) y,
      // con los `servicePrices` eager de cada seguro, produce un producto
      // cartesiano que revienta la memoria (OOM) en titulares con muchos seguros.
      loadEagerRelations: false,
    });
    if (!holder)
      throw new BadRequestException('Titular no encontrado o eliminado');

    if (dto.patientId && dto.patientId !== dto.holderId) {
      const pat = await this.patientsRepo.findOne({
        where: { id: dto.patientId, deletedAt: IsNull() },
        loadEagerRelations: false,
      });
      if (!pat)
        throw new BadRequestException('Paciente no encontrado o eliminado');
    }

    if (dto.type === 'insurance') {
      if (!dto.insuranceId)
        throw new BadRequestException('Tipo seguro: insuranceId requerido');
      if (!dto.insuranceSource)
        throw new BadRequestException(
          'Tipo seguro: insuranceSource requerido (direct | via_contractor)',
        );

      if (dto.insuranceSource === 'via_contractor') {
        if (!dto.contractorId)
          throw new BadRequestException(
            'insuranceSource=via_contractor requiere contractorId',
          );
        const contractor = (holder.contractors ?? []).find(
          (c) => c.id === dto.contractorId,
        );
        if (!contractor)
          throw new BadRequestException('Contratista no asignado al titular');
        const okInsurance = (contractor.insurances ?? []).some(
          (i) => i.id === dto.insuranceId,
        );
        if (!okInsurance)
          throw new BadRequestException(
            'Seguro no asociado al contratista del titular',
          );
      } else {
        if (dto.contractorId)
          throw new BadRequestException(
            'insuranceSource=direct no admite contractorId',
          );
        const okDirect = (holder.insurances ?? []).some(
          (i) => i.id === dto.insuranceId,
        );
        if (!okDirect)
          throw new BadRequestException(
            'Seguro no asignado directamente al titular',
          );
      }
    } else if (dto.contractorId || dto.insuranceId || dto.insuranceSource) {
      throw new BadRequestException(
        'contractorId/insuranceId/insuranceSource solo válidos para tipo seguro',
      );
    }

    if (
      dto.type !== 'insurance' &&
      dto.serviceKey &&
      dto.serviceKey.trim() !== ''
    ) {
      throw new BadRequestException(
        'serviceKey solo aplica para órdenes tipo seguro',
      );
    }

    // La tasa fija (Bs) ya no es un checkbox por-orden: se deriva del flag
    // `isIndexed` del seguro (UI: "No indexado"). Ver `resolveFixedRate`,
    // invocada en create/update.

    if (dto.orderDate && dto.appointmentDate) {
      if (new Date(dto.appointmentDate) < new Date(dto.orderDate))
        throw new BadRequestException('appointmentDate debe ser ≥ orderDate');
    }

    const rows = dto.serviceTypes ?? [];
    if (!rows.length) {
      throw new BadRequestException('Asigna al menos un tipo de servicio');
    }
    const stIds = rows.map((r) => r.serviceTypeId);
    if (new Set(stIds).size !== stIds.length) {
      throw new BadRequestException(
        'Hay tipos de servicio duplicados — cada ST debe aparecer una sola vez',
      );
    }
    const sts = await this.serviceTypesRepo.find({
      where: { id: In(stIds), deletedAt: IsNull() },
      select: ['id', 'isActive'],
    });
    if (sts.length !== stIds.length || sts.some((s) => !s.isActive)) {
      throw new BadRequestException(
        'Algún tipo de servicio no existe o está deshabilitado',
      );
    }

    // Especialidad por fila: obligatoria, existente y activa. Una orden puede
    // combinar varias (laboratorio + rayos X); `orders.specialtyId` se deriva
    // de la primera fila (especialidad principal).
    if (rows.some((r) => !r.specialtyId)) {
      throw new BadRequestException(
        'Cada tipo de servicio requiere su especialidad',
      );
    }
    const specialtyIds = Array.from(new Set(rows.map((r) => r.specialtyId)));
    const specialties = await this.specialtiesRepo.find({
      where: { id: In(specialtyIds), deletedAt: IsNull() },
      select: ['id', 'name', 'isActive'],
    });
    if (
      specialties.length !== specialtyIds.length ||
      specialties.some((s) => !s.isActive)
    ) {
      throw new BadRequestException(
        'Alguna especialidad no existe o está deshabilitada',
      );
    }
    const specialtyNameById = new Map(specialties.map((s) => [s.id, s.name]));
    const grandfathered = opts?.grandfatheredProviderSpecialties;
    const isGrandfathered = (row: OrderServiceTypeRowDto): boolean =>
      !!grandfathered?.has(providerSpecialtyKey(row));

    // Validate provider per row.
    const doctorIds = Array.from(
      new Set(
        rows.filter((r) => r.providerType === 'doctor').map((r) => r.doctorId!),
      ),
    );
    const ccIds = Array.from(
      new Set(
        rows
          .filter((r) => r.providerType === 'care_center')
          .map((r) => r.careCenterId!),
      ),
    );
    // loadEagerRelations:false → evita que Doctor/CareCenter auto-unan sus
    // eager to-many (phones, paymentMethods, servicePrices). Sin esto, .find()
    // multiplica filas por proveedor (producto cartesiano) y revienta el heap.
    // Sólo necesitamos isActive (y specialties explícito) para validar.
    const doctors = doctorIds.length
      ? await this.doctorsRepo.find({
          where: { id: In(doctorIds), deletedAt: IsNull() },
          relations: { specialties: true },
          loadEagerRelations: false,
        })
      : [];
    const ccs = ccIds.length
      ? await this.careCentersRepo.find({
          where: { id: In(ccIds), deletedAt: IsNull() },
          relations: { specialties: true },
          loadEagerRelations: false,
        })
      : [];
    const docMap = new Map(doctors.map((d) => [d.id, d]));
    const ccMap = new Map(ccs.map((c) => [c.id, c]));

    for (const row of rows) {
      if (row.providerType === 'doctor') {
        if (!row.doctorId) {
          throw new BadRequestException('Cada fila Doctor requiere doctorId');
        }
        if (row.careCenterId) {
          throw new BadRequestException('Fila Doctor no admite careCenterId');
        }
        const d = docMap.get(row.doctorId);
        if (!d || !d.isActive)
          throw new BadRequestException(
            `Doctor de un tipo de servicio no encontrado o deshabilitado`,
          );
        if (
          !isGrandfathered(row) &&
          !(d.specialties ?? []).some((s) => s.id === row.specialtyId)
        ) {
          throw new BadRequestException(
            `El doctor ${d.firstName} ${d.lastName} no tiene la especialidad ${
              specialtyNameById.get(row.specialtyId) ?? ''
            }`.trim(),
          );
        }
      } else {
        if (!row.careCenterId) {
          throw new BadRequestException(
            'Cada fila Centro requiere careCenterId',
          );
        }
        if (row.doctorId) {
          throw new BadRequestException('Fila Centro no admite doctorId');
        }
        const cc = ccMap.get(row.careCenterId);
        if (!cc || !cc.isActive)
          throw new BadRequestException(
            `Centro de un tipo de servicio no encontrado o deshabilitado`,
          );
        if (
          !isGrandfathered(row) &&
          !(cc.specialties ?? []).some((s) => s.id === row.specialtyId)
        ) {
          throw new BadRequestException(
            `El centro ${cc.businessName} no tiene la especialidad ${
              specialtyNameById.get(row.specialtyId) ?? ''
            }`.trim(),
          );
        }
      }
    }

    if (dto.pathologyIds && dto.pathologyIds.length) {
      const pIds = Array.from(new Set(dto.pathologyIds));
      const ps = await this.pathologiesRepo.find({
        where: { id: In(pIds), deletedAt: IsNull() },
        select: ['id', 'isActive'],
      });
      if (ps.length !== pIds.length || ps.some((p) => !p.isActive)) {
        throw new BadRequestException(
          'Alguna patología no existe o está deshabilitada',
        );
      }
    }

    return { holder };
  }

  /**
   * Normaliza un pago para guardar. Valida método→moneda y deriva
   * `amountInUsd` con el helper compartido. Si `usdExchangeRateId` viene
   * (ej. la orden ya tiene `billingExchangeRateId`), se usa como ref USD/Bs;
   * sino, se toma la última USD activa.
   */
  private async resolvePaymentForSave(
    p: CreateOrderPaymentDto,
    usdExchangeRateId?: string | null,
  ): Promise<Partial<OrderPayment>> {
    const out: Partial<OrderPayment> = {
      type: p.type,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber ?? null,
      bankCode: null,
      accountNumber: null,
      exchangeRateId: null,
      paymentAccountId: null,
      amountCurrency: p.amountCurrency,
      amountValue: p.amountValue.toFixed(2),
      amountInUsd: '0',
    };
    // Tasa USD/Bs de referencia para convertir. La tasa elegida en el propio
    // pago (Bs) manda sobre la de facturación: el pago pudo hacerse otro día,
    // a otra tasa.
    let usdCtxId = usdExchangeRateId ?? null;

    const needsPaymentAccount =
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'bank_transfer_usd' ||
      p.type === 'card' ||
      p.type === 'other';

    if (needsPaymentAccount) {
      if (!p.paymentAccountId)
        throw new BadRequestException(
          `paymentAccountId requerido para pagos de tipo ${p.type}`,
        );
      const account = await this.paymentAccounts.assertUsableForPaymentType(
        p.paymentAccountId,
        p.type as
          | 'mobile_payment'
          | 'bank_transfer'
          | 'bank_transfer_usd'
          | 'card'
          | 'other',
      );
      out.paymentAccountId = account.id;
      // Snapshot desde la cuenta para histórico — independiente de cambios futuros.
      out.bankCode = account.bankCode ?? null;
      out.accountNumber = account.accountNumber ?? null;
    } else if (p.paymentAccountId) {
      throw new BadRequestException(
        `Pagos de tipo ${p.type} no pueden referenciar una cuenta bancaria`,
      );
    }

    if (
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'card'
    ) {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException(
          'Pago móvil/transferencia/punto debe ser en BS',
        );
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'USD')
        throw new BadRequestException('Pago en BS requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'bank_transfer_usd') {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException(
          'Transferencia en dólares debe ser en USD',
        );
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_eur') {
      if (p.amountCurrency !== 'EUR')
        throw new BadRequestException('cash_eur debe ser en EUR');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido (EUR)');
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'EUR')
        throw new BadRequestException(
          'cash_eur requiere una tasa de cambio en EUR',
        );
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency === 'BS' || p.amountCurrency === 'EUR') {
        if (!p.exchangeRateId)
          throw new BadRequestException(
            `exchangeRateId requerido para pago other en ${p.amountCurrency}`,
          );
        const rate = await this.ratesRepo.findOne({
          where: { id: p.exchangeRateId },
        });
        if (!rate)
          throw new BadRequestException('Tasa de cambio no encontrada');
        if (p.amountCurrency === 'BS' && rate.currency !== 'USD')
          throw new BadRequestException('other en BS requiere tasa USD/Bs');
        if (p.amountCurrency === 'EUR' && rate.currency !== 'EUR')
          throw new BadRequestException('other en EUR requiere tasa EUR/Bs');
        out.exchangeRateId = p.exchangeRateId;
        if (p.amountCurrency === 'BS') usdCtxId = p.exchangeRateId;
      }
    }

    const usdAmount = await computeAmountInUsd(
      {
        amountValue: p.amountValue,
        amountCurrency: p.amountCurrency,
        exchangeRateId: p.exchangeRateId ?? null,
      },
      this.ratesRepo,
      { usdExchangeRateId: usdCtxId },
    );
    out.amountInUsd = usdAmount.toFixed(2);
    return out;
  }

  /** Σ de los pagos del Paso 1 convertidos a USD (moneda del precio). */
  private async sumPaymentsUsd(
    payments: CreateOrderPaymentDto[],
  ): Promise<number> {
    let total = 0;
    for (const p of payments) {
      total += await computeAmountInUsd(
        {
          amountValue: p.amountValue,
          amountCurrency: p.amountCurrency,
          exchangeRateId: p.exchangeRateId ?? null,
        },
        this.ratesRepo,
        {
          // Bs: la tasa elegida en el pago es la USD/Bs con la que se cuadra.
          usdExchangeRateId:
            p.amountCurrency === 'BS' ? p.exchangeRateId ?? null : null,
        },
      );
    }
    return Math.round(total * 100) / 100;
  }

  /**
   * Regla de pago del Paso 1 según tipo de orden:
   *  - `cash` (contado): los pagos deben CUADRAR el precio total (Σ = priceUsd).
   *  - `cashea`: la cuota inicial (`casheaFirstInstallmentAmount`) es un PAGO
   *    real del titular en el Paso 1; los pagos deben cubrirla (Σ ≈ inicial).
   *    Puede ser 0 (sin pago en el Paso 1) pero SIEMPRE menor al precio total
   *    (100% o más no permitido: Cashea debe financiar un restante > 0). El
   *    resto lo financia Cashea (queda como cuenta por cobrar).
   *  - `credit`/`insurance`: no se exige pago en el Paso 1.
   * Precio y pagos en USD (pricing USD-only). `sumUsd` aplica a `cash` y `cashea`.
   */
  private assertStep1Payments(
    type: 'cash' | 'credit' | 'insurance' | 'cashea',
    sumUsd: number,
    priceUsd: number,
    casheaInitialUsd: number | null | undefined,
  ): void {
    const TOL = 0.01;
    if (type === 'cash') {
      if (priceUsd <= 0) {
        throw new BadRequestException(
          'La orden de contado no tiene monto a cobrar',
        );
      }
      if (Math.abs(sumUsd - priceUsd) > TOL) {
        throw new BadRequestException(
          `La orden de contado debe estar cuadrada: pagos USD ${sumUsd.toFixed(2)} de ${priceUsd.toFixed(2)}`,
        );
      }
    } else if (type === 'cashea') {
      const initial = Number(casheaInitialUsd ?? 0);
      if (initial >= priceUsd) {
        throw new BadRequestException(
          'La inicial Cashea debe ser menor al precio total de la orden',
        );
      }
      if (Math.abs(sumUsd - initial) > TOL) {
        throw new BadRequestException(
          `Cashea: los pagos deben cubrir la inicial: pagos USD ${sumUsd.toFixed(2)} de inicial ${initial.toFixed(2)}`,
        );
      }
    }
    // credit / insurance: sin requisito de pago en el Paso 1.
  }

  /** True si el seguro (por id) tiene `isIndexed=true` (UI: "No indexado" → tasa fija de la orden). */
  private async insuranceIsIndexed(insuranceId: string): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ isIndexed: boolean }>>(
      `SELECT "isIndexed" FROM "insurances" WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [insuranceId],
    );
    return rows[0]?.isIndexed === true;
  }

  /**
   * Última tasa USD/Bs activa con fecha efectiva ≤ `at` (fallback: la más
   * reciente que exista). Sirve de provisional para la tasa fija de una orden
   * de seguro no indexado mientras no se factura.
   */
  private async usdRateAt(at?: string | Date | null): Promise<string | null> {
    const qb = this.ratesRepo
      .createQueryBuilder('r')
      .where('r.currency = :c', { c: 'USD' })
      .andWhere('r.isActive = true')
      .orderBy('r.effectiveDate', 'DESC')
      .limit(1);
    if (at) {
      // `orderDate` viene date-only: se compara contra el FIN de ese día en
      // Venezuela (UTC-04:00), sino la tasa publicada ese mismo día queda fuera.
      const raw = typeof at === 'string' ? at : at.toISOString();
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T23:59:59-04:00`
        : raw;
      const found = await qb
        .clone()
        .andWhere('r.effectiveDate <= :at', { at: iso })
        .getOne();
      if (found) return found.id;
    }
    return (await qb.getOne())?.id ?? null;
  }

  /**
   * Deriva el modo tasa fija de la orden a partir del seguro:
   *  - Seguro `isIndexed=true` (UI: "No indexado") → `useFixedRate=true` con
   *    `fixedExchangeRateId` (tasa USD/Bs). **La tasa definitiva se elige en el
   *    Paso 4 junto con la de la factura**; en el Paso 1 se deja la del día de
   *    la orden como provisional (la orden todavía no entra a Cuentas por
   *    cobrar: eso ocurre al finalizar).
   *  - Seguro `isIndexed=false` (UI: "Indexado") / no-seguro → `useFixedRate=false`,
   *    sin tasa fija (se cobra a la tasa del día del cobro).
   */
  private async resolveFixedRate(
    type: 'cash' | 'credit' | 'insurance' | 'cashea',
    insuranceId: string | null | undefined,
    requestedRateId: string | null | undefined,
    orderDate?: string | Date | null,
  ): Promise<{ useFixedRate: boolean; fixedExchangeRateId: string | null }> {
    if (type !== 'insurance' || !insuranceId) {
      return { useFixedRate: false, fixedExchangeRateId: null };
    }
    const indexed = await this.insuranceIsIndexed(insuranceId);
    if (!indexed) return { useFixedRate: false, fixedExchangeRateId: null };
    if (!requestedRateId) {
      const provisional = await this.usdRateAt(orderDate);
      if (!provisional) {
        throw new BadRequestException(
          'No hay tasa de cambio USD cargada. Carga una en Tasas de cambio antes de crear la orden.',
        );
      }
      return { useFixedRate: true, fixedExchangeRateId: provisional };
    }
    const rate = await this.ratesRepo.findOne({
      where: { id: requestedRateId },
    });
    if (!rate) throw new BadRequestException('Tasa de la orden no encontrada');
    if (rate.currency !== 'USD') {
      throw new BadRequestException('La tasa de la orden debe ser USD/Bs');
    }
    return { useFixedRate: true, fixedExchangeRateId: requestedRateId };
  }

  async create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<Order> {
    await this.validateCoreReferences(dto, user);

    // Número de orden elegido en el Paso 1 (por defecto el FE propone el mayor
    // + 1). Cualquier entero libre es válido, pero fijarlo requiere permiso.
    if (
      dto.customOrderNumber != null &&
      !this.userHasPermission(user, PERMISSIONS.ORDERS.CUSTOM_NUMBER)
    ) {
      throw new ForbiddenException(
        'No tienes permiso para asignar el número de orden',
      );
    }
    if (dto.customOrderNumber != null) {
      this.assertOrderNumberRange(dto.customOrderNumber);
    }

    // Tasa fija derivada del seguro (isIndexed=true, UI "No indexado"). La tasa
    // definitiva la elige el Paso 4 con la de la factura; aquí queda provisional.
    const fixed = await this.resolveFixedRate(
      dto.type,
      dto.insuranceId ?? null,
      dto.fixedExchangeRateId ?? null,
      dto.orderDate,
    );

    // Monto base (catálogo) + ajuste con motivo. Sin orders.edit-amount el
    // monto se fuerza al base.
    const priceAdj = await this.resolvePriceAdjustment(
      {
        type: dto.type,
        insuranceId: dto.insuranceId ?? null,
        rows: dto.serviceTypes,
        requestedAmount: dto.priceAmount,
        note: dto.priceAdjustmentNote,
      },
      user,
    );
    const effectivePriceAmount = priceAdj.priceAmount;

    // Snapshot Cashea: la inicial la ingresa el usuario; las tasas (comisión
    // sobre el total + financiamiento sobre el restante) se toman de la config
    // global vigente. La inicial no genera comisión propia.
    let casheaFields: {
      casheaFirstInstallmentAmount: string;
      casheaCommissionRate: string;
      casheaFinancingRate: string;
    } | null = null;
    if (dto.type === 'cashea') {
      const firstAmount = dto.casheaFirstInstallmentAmount ?? 0;
      if (firstAmount >= effectivePriceAmount) {
        throw new BadRequestException(
          'La inicial Cashea debe ser menor al precio total de la orden',
        );
      }
      const cfg = await this.appConfig.getCasheaCommissionConfig();
      casheaFields = {
        casheaFirstInstallmentAmount: firstAmount.toFixed(2),
        casheaCommissionRate: cfg.commissionRate.toFixed(4),
        casheaFinancingRate: cfg.financingRate.toFixed(4),
      };
    }

    // Regla de pago Paso 1: contado cuadrado / cashea con inicial pagada.
    const step1SumUsd =
      dto.type === 'cash' || dto.type === 'cashea'
        ? await this.sumPaymentsUsd(dto.payments ?? [])
        : 0;
    this.assertStep1Payments(
      dto.type,
      step1SumUsd,
      effectivePriceAmount,
      dto.casheaFirstInstallmentAmount,
    );

    const serviceKeyValue =
      dto.type === 'insurance' && dto.serviceKey?.trim()
        ? dto.serviceKey.trim()
        : null;

    const savedId = await this.dataSource.transaction(async (mgr) => {
      // Clave de servicio no repetida entre órdenes vivas (no se reutiliza).
      await this.assertServiceKeyAvailable(mgr, serviceKeyValue);
      // Una orden interna (= un número) por proveedor distinto. Se extraen todos
      // los números por adelantado; el primero es además el número BASE de la
      // orden (base == proveedor 1). Una orden siempre tiene ≥1 proveedor.
      const distinct = this.distinctProvidersFromRows(dto.serviceTypes);
      const numbers =
        dto.customOrderNumber != null
          ? await this.drawOrderNumbers(mgr, distinct.length, {
              base: dto.customOrderNumber,
            })
          : await this.drawOrderNumbers(mgr, distinct.length);
      const orderNumber = numbers[0];
      const entity = mgr.create(Order, {
        orderNumber,
        branchId: dto.branchId,
        type: dto.type,
        status: 'draft',
        holderId: dto.holderId,
        patientId: dto.patientId,
        contractorId: dto.contractorId ?? null,
        insuranceId: dto.insuranceId ?? null,
        insuranceSource:
          dto.type === 'insurance' ? (dto.insuranceSource ?? null) : null,
        serviceKey: serviceKeyValue,
        isReimbursement: dto.type === 'credit' ? !!dto.isReimbursement : false,
        specialtyId: this.primarySpecialtyId(dto.serviceTypes),
        orderDate: dto.orderDate,
        appointmentDate: new Date(dto.appointmentDate),
        priceAmount: effectivePriceAmount.toFixed(2),
        priceBaseAmount: priceAdj.priceBaseAmount,
        priceAdjustmentNote: priceAdj.priceAdjustmentNote,
        priceAdjustedById: priceAdj.priceAdjustedById,
        priceAdjustedAt: priceAdj.priceAdjustedAt,
        casheaFirstInstallmentAmount:
          casheaFields?.casheaFirstInstallmentAmount ?? null,
        casheaCommissionRate: casheaFields?.casheaCommissionRate ?? null,
        casheaFinancingRate: casheaFields?.casheaFinancingRate ?? null,
        useFixedRate: fixed.useFixedRate,
        fixedExchangeRateId: fixed.fixedExchangeRateId,
        createdById: user.id,
      });
      const saved = await mgr.save(entity);

      // Crear las órdenes internas (1 por proveedor distinto) con su número.
      const iioByKey = new Map<
        ProviderKey,
        { id: string; internalNumber: string }
      >();
      let position = 0;
      for (const { providerType, providerId, key } of distinct) {
        const internalNumber = numbers[position];
        position += 1;
        const inserted = await mgr.query<{ id: string }[]>(
          `INSERT INTO "order_internal_orders"
             ("orderId", "providerType", "doctorId", "careCenterId", "internalNumber", "sequencePosition")
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            saved.id,
            providerType,
            providerType === 'doctor' ? providerId : null,
            providerType === 'care_center' ? providerId : null,
            internalNumber,
            position,
          ],
        );
        iioByKey.set(key, { id: inserted[0].id, internalNumber });
      }

      // Insertar filas OST (ligadas a su orden interna).
      await this.persistOrderServiceTypes(
        mgr,
        saved.id,
        dto.serviceTypes,
        iioByKey,
        fixed.useFixedRate,
      );

      const pIds = Array.from(new Set(dto.pathologyIds ?? []));
      if (pIds.length) {
        await mgr
          .createQueryBuilder()
          .relation(Order, 'pathologies')
          .of(saved.id)
          .add(pIds);
      }

      if (
        (dto.type === 'cash' || dto.type === 'cashea') &&
        dto.payments?.length
      ) {
        for (const p of dto.payments) {
          const payload = await this.resolvePaymentForSave(p, null);
          await mgr.save(
            mgr.create(OrderPayment, { ...payload, orderId: saved.id }),
          );
        }
      }

      // Snapshot de precios de cobro (Paso 1).
      await this.snapshotBuyerPricing(
        mgr,
        saved.id,
        dto.type,
        dto.insuranceId ?? null,
        dto.serviceTypes.map((r) => r.serviceTypeId),
      );

      // Modelo Pendientes + Lotes: las cuentas por pagar/cobrar NO se auto-generan.
      // El usuario arma los lotes manualmente desde sus módulos. El monto a cada
      // proveedor se persiste en `order_internal_orders.providerAmountUsd` al
      // facturar (Paso 4); las órdenes con deudor quedan como pendientes de cobro.

      // El ajuste de monto al crear queda en el historial (además de las
      // columnas de trazabilidad de la orden).
      await this.logChange(
        mgr,
        saved.id,
        user.id,
        'create',
        priceAdj.priceAdjustmentNote
          ? {
              priceAmount: { to: +effectivePriceAmount.toFixed(2) },
              priceBaseAmount: { to: Number(priceAdj.priceBaseAmount) },
              priceAdjustmentNote: { to: priceAdj.priceAdjustmentNote },
            }
          : null,
      );

      return saved.id;
    });

    return this.findOne(savedId, user);
  }

  /**
   * Inserta las filas OST, cada una ligada a la orden interna de su proveedor
   * (`internalOrderId`). El borrado previo lo hace el caller: en `update` debe
   * ocurrir ANTES de reconciliar `order_internal_orders` (la FK OST→interna
   * impide borrar una interna mientras alguna fila OST la referencie). Usa raw
   * inserts para evitar problemas con composite PK + relations.
   */
  private async persistOrderServiceTypes(
    mgr: EntityManager,
    orderId: string,
    rows: OrderServiceTypeRowDto[],
    iioByKey: Map<ProviderKey, { id: string; internalNumber: string }>,
    allowIndexedRows: boolean,
  ): Promise<void> {
    if (!rows.length) return;
    // Todo ST tiene cantidad (≥1, default 1).
    const values = rows.map((r) => {
      const providerId =
        r.providerType === 'doctor' ? r.doctorId! : r.careCenterId!;
      const iio = iioByKey.get(
        `${r.providerType}:${providerId}` as ProviderKey,
      );
      if (!iio) {
        throw new BadRequestException(
          'Falta la orden interna del proveedor de un tipo de servicio',
        );
      }
      return {
        orderId,
        serviceTypeId: r.serviceTypeId,
        providerType: r.providerType,
        specialtyId: r.specialtyId,
        doctorId: r.providerType === 'doctor' ? (r.doctorId ?? null) : null,
        careCenterId:
          r.providerType === 'care_center' ? (r.careCenterId ?? null) : null,
        quantity: Math.max(1, Math.trunc(r.quantity ?? 1)),
        customName: (r.customName ?? '').trim(),
        // ST indexado sólo tiene sentido con seguro no indexado (orden en modo
        // tasa fija); en cualquier otro caso se fuerza false.
        isIndexed: allowIndexedRows ? !!r.isIndexed : false,
        internalOrderId: iio.id,
      };
    });
    await mgr.insert(OrderServiceType, values);
  }

  /**
   * Reconcilia `order_internal_orders` en una edición de borrador. Devuelve el
   * mapa proveedor→(id, número) COMPLETO (sobrevivientes + nuevos) para ligar
   * las filas OST. Requiere que las filas OST de la orden YA hayan sido borradas
   * (la FK OST→interna es CASCADE; borrar OST primero deja las internas sin
   * referencias y permite eliminar las huérfanas con seguridad).
   *
   *  - Sobreviviente (proveedor sigue): se mantiene su fila y su número (NUNCA
   *    se renumera).
   *  - Quitado (proveedor ya no está): se BORRA su fila → su número queda como
   *    hueco definitivo (no se reutiliza).
   *  - Nuevo: toma el primer número LIBRE después del base de la orden
   *    (`contiguousBase`) para quedar contiguo a sus hermanas, o el siguiente de
   *    la marca de agua si la orden no tiene base numérico.
   *
   * `orders.orderNumber` (base) NO se toca aquí: queda congelado aun si el
   * proveedor de la posición 1 se quita (política FREEZE).
   */
  private async reconcileInternalOrders(
    mgr: EntityManager,
    orderId: string,
    distinct: Array<{
      providerType: 'doctor' | 'care_center';
      providerId: string;
      key: ProviderKey;
    }>,
    contiguousBase: number | null = null,
  ): Promise<Map<ProviderKey, { id: string; internalNumber: string }>> {
    const existing = await mgr.query<
      Array<{
        id: string;
        providerType: 'doctor' | 'care_center';
        doctorId: string | null;
        careCenterId: string | null;
        internalNumber: string;
        sequencePosition: number;
      }>
    >(
      `SELECT id, "providerType", "doctorId", "careCenterId", "internalNumber", "sequencePosition"
       FROM "order_internal_orders" WHERE "orderId" = $1`,
      [orderId],
    );
    const keepKeys = new Set(distinct.map((p) => p.key));
    const map = new Map<ProviderKey, { id: string; internalNumber: string }>();
    let maxPos = 0;
    for (const r of existing) {
      if (r.sequencePosition > maxPos) maxPos = r.sequencePosition;
      const pid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
      const key = `${r.providerType}:${pid}` as ProviderKey;
      if (keepKeys.has(key)) {
        map.set(key, { id: r.id, internalNumber: r.internalNumber });
      } else {
        // Proveedor quitado: borra su orden interna → su número queda quemado.
        await mgr.query(`DELETE FROM "order_internal_orders" WHERE id = $1`, [
          r.id,
        ]);
      }
    }
    for (const { providerType, providerId, key } of distinct) {
      if (map.has(key)) continue;
      // Contiguo al base de la orden: primer libre ≥ base + 1 (rellena los
      // huecos propios de la orden en vez de saltar a la marca de agua).
      const [internalNumber] = await this.drawOrderNumbers(
        mgr,
        1,
        contiguousBase != null ? { from: contiguousBase + 1 } : undefined,
      );
      maxPos += 1;
      const inserted = await mgr.query<{ id: string }[]>(
        `INSERT INTO "order_internal_orders"
           ("orderId", "providerType", "doctorId", "careCenterId", "internalNumber", "sequencePosition")
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          orderId,
          providerType,
          providerType === 'doctor' ? providerId : null,
          providerType === 'care_center' ? providerId : null,
          internalNumber,
          maxPos,
        ],
      );
      map.set(key, { id: inserted[0].id, internalNumber });
    }
    return map;
  }

  /**
   * Especialidad PRINCIPAL de la orden = la de la primera fila ST. `orders.
   * specialtyId` es derivada (la especialidad real vive por fila en
   * `order_service_types`); la usan el filtro del listado, el dashboard y los
   * reportes, que siguen mostrando una sola por orden.
   */
  private primarySpecialtyId(rows: OrderServiceTypeRowDto[]): string {
    const id = rows[0]?.specialtyId;
    if (!id)
      throw new BadRequestException(
        'Cada tipo de servicio requiere su especialidad',
      );
    return id;
  }

  /** Set único de proveedores activos en la orden. Preserva orden de aparición. */
  private distinctProvidersFromRows(rows: OrderServiceTypeRowDto[]): Array<{
    providerType: 'doctor' | 'care_center';
    providerId: string;
    key: ProviderKey;
  }> {
    const seen = new Set<string>();
    const out: Array<{
      providerType: 'doctor' | 'care_center';
      providerId: string;
      key: ProviderKey;
    }> = [];
    for (const r of rows) {
      const providerId =
        r.providerType === 'doctor' ? r.doctorId! : r.careCenterId!;
      const key = `${r.providerType}:${providerId}` as ProviderKey;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ providerType: r.providerType, providerId, key });
    }
    return out;
  }

  // ----- Transiciones de estado (Pasos 2-4) -----

  async attend(
    id: string,
    dto: AttendOrderDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    this.assertNotCancelled(order);
    if (!['draft', 'in_progress', 'attended'].includes(order.status)) {
      throw new BadRequestException(
        'La orden no puede pasar a atendida desde su estado actual',
      );
    }
    const attendedAt = dto.attended
      ? dto.attendedAt
        ? new Date(dto.attendedAt)
        : new Date()
      : null;
    const status: OrderStatus = dto.attended
      ? 'attended'
      : order.status === 'attended'
        ? 'in_progress'
        : order.status;
    // `update` por columnas — la orden trae `providerReports` cargada y
    // `save(order)` intentaría sincronizar esa relación (nullear FKs).
    await this.repo.update(
      { id: order.id },
      { attended: dto.attended, attendedAt, status },
    );
    if (order.attended !== dto.attended) {
      await this.logChange(null, order.id, user.id, 'attend', {
        attended: { from: order.attended, to: dto.attended },
      });
    }
    return this.findOne(id, user);
  }

  async report(
    id: string,
    dto: ReportOrderDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    // `otherStudies`, observaciones por proveedor y adjuntos son editables
    // retroactivamente. Solo se bloquea `draft`/`in_progress` (orden aún sin
    // atender — no tiene sentido emitir informe).
    this.assertNotCancelled(order);
    if (order.status === 'draft' || order.status === 'in_progress') {
      throw new BadRequestException(
        'La orden debe estar atendida para emitir informe',
      );
    }

    const provider = await this.resolveProvider(user);

    // Proveedores distintos presentes en la orden (vía OST).
    const orderProviders = this.distinctProvidersFromRows(
      (order.orderServiceTypes ?? []).map((ost) => ({
        serviceTypeId: ost.serviceTypeId,
        providerType: ost.providerType,
        specialtyId: ost.specialtyId,
        doctorId: ost.doctorId ?? undefined,
        careCenterId: ost.careCenterId ?? undefined,
        customName: ost.customName ?? '',
      })),
    );
    const validKeys = new Set<string>(orderProviders.map((p) => p.key));

    await this.dataSource.transaction(async (mgr) => {
      // Patch de columnas escalares de la orden. Importante: NO usar
      // `mgr.save(order)` — la orden viene con la relación `providerReports`
      // cargada y `save` intentaría sincronizarla (nullear el FK de las filas
      // recién upserteadas). Se actualizan sólo columnas vía `mgr.update`.
      const patch: Partial<Order> = {};

      if (provider) {
        // Usuario proveedor: solo su propio segmento; no toca la nota general.
        const ownKey = `${provider.type}:${provider.id}`;
        if (!validKeys.has(ownKey)) {
          throw new ForbiddenException('No participas en esta orden');
        }
        for (const r of dto.providerReports ?? []) {
          const pid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
          if (`${r.providerType}:${pid ?? ''}` !== ownKey) {
            throw new ForbiddenException(
              'Solo puedes editar las observaciones de tu propio informe',
            );
          }
          await this.upsertProviderReport(
            mgr,
            order.id,
            provider.type,
            provider.id,
            r.observations ?? null,
          );
        }
      } else {
        // Staff: nota general + cualquier segmento de proveedor de la orden.
        if (dto.otherStudies !== undefined) {
          patch.otherStudies =
            dto.otherStudies && dto.otherStudies.trim() !== ''
              ? dto.otherStudies
              : null;
        }
        for (const r of dto.providerReports ?? []) {
          const pid =
            r.providerType === 'doctor' ? r.doctorId! : r.careCenterId!;
          const key = `${r.providerType}:${pid}`;
          if (!validKeys.has(key)) {
            throw new BadRequestException(
              `El proveedor del informe no participa en la orden (${key})`,
            );
          }
          await this.upsertProviderReport(
            mgr,
            order.id,
            r.providerType,
            pid,
            r.observations ?? null,
          );
        }
      }
      if (order.status === 'attended') patch.status = 'report_issued';
      if (Object.keys(patch).length) {
        await mgr.update(Order, { id: order.id }, patch);
      }

      await this.logChange(mgr, order.id, user.id, 'report');
    });

    return this.findOne(id, user);
  }

  /** Upsert (por proveedor) de las observaciones del informe. */
  private async upsertProviderReport(
    mgr: EntityManager,
    orderId: string,
    providerType: 'doctor' | 'care_center',
    providerId: string,
    observations: string | null,
  ): Promise<void> {
    const obs =
      observations && observations.trim() !== '' ? observations : null;
    const doctorId = providerType === 'doctor' ? providerId : null;
    const careCenterId = providerType === 'care_center' ? providerId : null;
    // Raw SQL (igual que las cuentas auto-generadas): evita la ambigüedad de
    // mapeo columna/relación del FK `orderId` en el insert del ORM.
    const existing = await mgr.query<Array<{ id: string }>>(
      providerType === 'doctor'
        ? `SELECT id FROM "order_provider_reports" WHERE "orderId" = $1 AND "doctorId" = $2 LIMIT 1`
        : `SELECT id FROM "order_provider_reports" WHERE "orderId" = $1 AND "careCenterId" = $2 LIMIT 1`,
      [orderId, providerId],
    );
    if (existing[0]) {
      await mgr.query(
        `UPDATE "order_provider_reports" SET "observations" = $1, "updatedAt" = now() WHERE id = $2`,
        [obs, existing[0].id],
      );
    } else {
      await mgr.query(
        `INSERT INTO "order_provider_reports"
           ("orderId", "providerType", "doctorId", "careCenterId", "observations")
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, providerType, doctorId, careCenterId, obs],
      );
    }
  }

  /**
   * Paso 1 — Autorización de monto por un validador.
   *
   * Cuando el usuario que edita la orden no tiene `orders.edit-amount`, otro
   * usuario que sí lo tenga valida sus credenciales (email + contraseña) e
   * ingresa el nuevo monto + observación. Queda registrado como autor del cambio.
   * Sólo aplica a órdenes en `draft` (cualquier tipo: el monto de catálogo,
   * baremo del seguro incluido, admite descuento o recargo justificado).
   */
  async authorizeAmount(
    id: string,
    dto: AuthorizeOrderAmountDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    if (order.status !== 'draft') {
      throw new BadRequestException(
        'Solo se puede autorizar el monto mientras la orden está en el Paso 1 (orden creada, sin atender)',
      );
    }
    this.assertStep1Editable(order, user);

    const validator = await this.authService.verifyValidator(
      dto.validatorEmail,
      dto.validatorPassword,
    );
    const canEditAmount =
      validator.isSuperAdmin ||
      validator.permissions.includes(PERMISSIONS.ORDERS.EDIT_AMOUNT);
    if (!canEditAmount) {
      throw new ForbiddenException(
        'El validador no tiene permiso para modificar el monto',
      );
    }

    // El monto autorizado también es un ajuste del Paso 1: el validador queda
    // como autor del descuento/recargo y su observación como motivo.
    const { sum: catalogSum, complete: catalogComplete } =
      await this.computeCatalogSum(
        order.type,
        order.insuranceId ?? null,
        (order.orderServiceTypes ?? []).map((ost) => ({
          serviceTypeId: ost.serviceTypeId,
          quantity: ost.quantity ?? 1,
        })),
      );
    const now = new Date();
    const observation = dto.observation.trim();
    // Catálogo incompleto: el base no es comparable ⇒ base = monto, sin ajuste.
    const base = catalogComplete ? catalogSum : dto.priceAmount;
    const adjusted =
      catalogComplete &&
      Math.round(dto.priceAmount * 100) !== Math.round(base * 100);

    // `update` por columnas (la orden trae `providerReports` cargada).
    await this.repo.update(
      { id: order.id },
      {
        priceAmount: dto.priceAmount.toFixed(2),
        priceBaseAmount: base.toFixed(2),
        priceAdjustmentNote: adjusted ? observation : null,
        priceAdjustedById: adjusted ? validator.id : null,
        priceAdjustedAt: adjusted ? now : null,
        amountAuthorizedById: validator.id,
        amountAuthorizedAt: now,
        amountAuthorizationNote: observation,
      },
    );
    await this.logChange(null, order.id, user.id, 'authorize_amount', {
      priceAmount: {
        from: Number(order.priceAmount),
        to: +dto.priceAmount.toFixed(2),
      },
      priceBaseAmount: {
        from:
          order.priceBaseAmount != null ? Number(order.priceBaseAmount) : null,
        to: base,
      },
      priceAdjustmentNote: {
        from: order.priceAdjustmentNote ?? null,
        to: adjusted ? observation : null,
      },
    });
    return this.findOne(id, user);
  }

  /**
   * Paso 4 — Facturación con pagos USD por proveedor.
   *
   * - `providers[]` debe cubrir exactamente el set de proveedores distintos de
   *   la orden (uno por proveedor; sin duplicados; sin sobrantes ni faltantes).
   * - Cada `amount` está en USD; cap global `Σ amount ≤ priceAmount`.
   * - Snapshot replace-all de `kind ∈ {doctor, care_center}` por ST.
   * - `doctorAmount` = total USD; `doctorAmountSuggested` = suma sugeridos USD.
   * - `billingExchangeRateId` es la tasa USD/Bs **elegida** al facturar (debe ser
   *   USD). Se escribe en `billingExchangeRateId` (conversión de CxP /
   *   retenciones / reportes), en `invoiceExchangeRateId` cuando se emite
   *   factura (la que se imprime) y, si la orden es de seguro no indexado
   *   (`useFixedRate`), en `fixedExchangeRateId` (target Bs de la CxC).
   * - `generateInvoice`: la factura es obligatoria en seguro y OPCIONAL en
   *   contado / crédito / cashea (por defecto no se emite). Sin factura la
   *   orden finaliza igual y puede emitirla después (`issueInvoice`).
   */
  async billing(
    id: string,
    dto: BillingOrderDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    this.assertNotCancelled(order);
    if (order.status !== 'report_issued') {
      throw new BadRequestException(
        'La orden debe tener informe emitido para pasar a facturación',
      );
    }

    const rate = await resolveUsdRate(
      this.ratesRepo,
      dto.billingExchangeRateId,
    );
    void rate;

    // Set de proveedores esperados según las filas OST de la orden.
    const orderRows = (order.orderServiceTypes ?? []).map((ost) => ({
      serviceTypeId: ost.serviceTypeId,
      providerType: ost.providerType,
      specialtyId: ost.specialtyId,
      doctorId: ost.doctorId ?? undefined,
      careCenterId: ost.careCenterId ?? undefined,
      customName: ost.customName ?? '',
    }));
    const qtyByST = new Map(
      (order.orderServiceTypes ?? []).map((ost) => [
        ost.serviceTypeId,
        ost.quantity ?? 1,
      ]),
    );
    const expected = this.distinctProvidersFromRows(orderRows);
    const expectedSet = new Set(expected.map((p) => p.key));

    // Set de proveedores en dto.providers.
    const seenKeys = new Set<string>();
    const dtoMap = new Map<ProviderKey, BillingProviderDto>();
    for (const p of dto.providers) {
      const pid = p.providerType === 'doctor' ? p.doctorId! : p.careCenterId!;
      const key = `${p.providerType}:${pid}` as ProviderKey;
      if (seenKeys.has(key)) {
        throw new BadRequestException('Proveedor duplicado en la facturación');
      }
      seenKeys.add(key);
      dtoMap.set(key, p);
    }
    if (seenKeys.size !== expectedSet.size) {
      throw new BadRequestException(
        'Cantidad de proveedores facturados no coincide con la orden',
      );
    }
    for (const key of expectedSet) {
      if (!seenKeys.has(key))
        throw new BadRequestException(
          `Falta el pago para un proveedor de la orden (${key})`,
        );
    }
    for (const key of seenKeys) {
      if (!expectedSet.has(key as ProviderKey))
        throw new BadRequestException(
          `Proveedor facturado no participa en la orden (${key})`,
        );
    }

    // ¿Se emite factura? En seguro siempre; en contado / crédito / cashea es
    // opcional y por defecto NO se emite (se puede emitir después con
    // `POST /orders/:id/invoices`).
    const generateInvoice =
      order.type === 'insurance' ? true : (dto.generateInvoice ?? false);
    if (generateInvoice && dto.invoiceNumber == null) {
      throw new BadRequestException(
        'Ingresa el número de factura para emitirla',
      );
    }
    // Fecha a mostrar en la factura. Sin enviar → la fecha de la orden.
    const invoiceDate = (dto.invoiceDate ?? order.orderDate).slice(0, 10);
    const invoiceNumber = generateInvoice
      ? this.assertInvoiceNumberRange(dto.invoiceNumber!)
      : null;
    const invoiceDisplay =
      invoiceNumber !== null ? formatInvoiceNumber(invoiceNumber) : null;
    const controlNumber =
      invoiceNumber !== null ? deriveControlNumber(invoiceNumber) : null;
    // Switch del Paso 4 (sólo seguros). Sin elección explícita queda `null` y
    // manda la regla derivada: se imprime salvo en seguro no indexado.
    const showExchangeRate = dto.showExchangeRate ?? null;

    // Total USD + validación cap.
    const priceAmount = Number(order.priceAmount);
    let totalUsd = 0;
    for (const p of dto.providers) {
      totalUsd += p.amount;
    }
    if (totalUsd > priceAmount + 0.005) {
      throw new BadRequestException(
        'La suma de pagos a proveedores supera el monto declarado de la orden',
      );
    }

    // Sugeridos + snapshots per provider.
    let suggestedSum = 0;
    const snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }> = [];
    for (const prov of expected) {
      const rowsForProv = orderRows.filter((r) => {
        const pid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
        return r.providerType === prov.providerType && pid === prov.providerId;
      });
      const stIds = rowsForProv.map((r) => r.serviceTypeId);
      const { suggested, snapshotRows: rows } =
        await this.computeProviderPricing(
          prov.providerType,
          prov.providerId,
          stIds,
          qtyByST,
        );
      suggestedSum += suggested;
      snapshotRows.push(...rows);
    }

    // Replace-all snapshots del lado pago + per-account providerAmount.
    await this.dataSource.transaction(async (mgr) => {
      // La factura nace aquí: número libre (nunca reutilizable) + control
      // derivado. El lock serializa dos facturaciones simultáneas. Sin factura
      // (contado / crédito / cashea sin activar) la orden finaliza igual.
      if (invoiceNumber !== null) {
        await this.lockInvoiceNumbers(mgr);
        await this.assertInvoiceNumberFree(mgr, invoiceNumber, order.id);
        await mgr.insert(OrderInvoice, {
          orderId: order.id,
          number: String(invoiceNumber),
          invoiceNumber: invoiceDisplay!,
          controlNumber: controlNumber!,
          invoiceDate,
          showExchangeRate,
          exchangeRateId: dto.billingExchangeRateId,
          status: 'active',
          createdById: user.id,
        });
      }
      // `update` por columnas — la orden trae `providerReports` cargada y
      // `save(order)` intentaría sincronizar esa relación (nullear FKs).
      await mgr.update(
        Order,
        { id: order.id },
        {
          doctorAmountSuggested: suggestedSum.toFixed(2),
          doctorAmount: totalUsd.toFixed(2),
          billingExchangeRateId: dto.billingExchangeRateId,
          // Seguro no indexado: la misma tasa fija la cuenta por cobrar en Bs
          // (el campo que antes se elegía en el Paso 1).
          ...(order.useFixedRate
            ? { fixedExchangeRateId: dto.billingExchangeRateId }
            : {}),
          // Espejo de la factura vigente: sin emitirla, la orden queda sin
          // datos fiscales (se llenan al emitirla después).
          ...(invoiceNumber !== null
            ? {
                invoiceNumber: invoiceDisplay,
                controlNumber,
                invoiceDate,
                invoiceShowExchangeRate: showExchangeRate,
                invoiceExchangeRateId: dto.billingExchangeRateId,
              }
            : {}),
          status: 'finalized',
        },
      );
      await mgr.delete(OrderServicePricing, {
        orderId: order.id,
        kind: In(['doctor', 'care_center']),
      });
      if (snapshotRows.length) {
        await mgr.insert(
          OrderServicePricing,
          snapshotRows.map((r) => ({ ...r, orderId: order.id })),
        );
      }

      // Escribir el monto USD a pagar por cada proveedor en SU orden interna
      // (`providerAmountUsd`). Es la "unidad de deuda" del módulo Cuentas por
      // pagar: queda como pendiente listo para que el usuario arme un lote.
      for (const p of dto.providers) {
        const providerId =
          p.providerType === 'doctor' ? p.doctorId! : p.careCenterId!;
        await mgr.query(
          `UPDATE "order_internal_orders"
           SET "providerAmountUsd" = $1
           WHERE "orderId" = $2
             AND "providerType" = $3
             AND COALESCE("doctorId", "careCenterId") = $4`,
          [p.amount.toFixed(2), order.id, p.providerType, providerId],
        );
      }

      await this.logChange(mgr, order.id, user.id, 'billing', {
        doctorAmount: {
          from: order.doctorAmount != null ? Number(order.doctorAmount) : null,
          to: +totalUsd.toFixed(2),
        },
        ...(invoiceNumber !== null
          ? {
              invoiceNumber: { to: invoiceDisplay },
              controlNumber: { to: controlNumber },
              invoiceDate: { to: invoiceDate },
              invoiceExchangeRateId: {
                from: order.invoiceExchangeRateId ?? null,
                to: dto.billingExchangeRateId,
              },
            }
          : { invoiceNumber: { to: null } }),
      });
    });
    return this.findOne(id, user);
  }

  // ---- Facturas del Paso 4 (numeración, emisión y anulación) ----

  /** Rango válido del N° de factura, sin tocar la BD. */
  private assertInvoiceNumberRange(value: number): number {
    const n = Math.trunc(value);
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException(
        'El número de factura debe ser mayor o igual a 1',
      );
    }
    if (n > MAX_INVOICE_NUMBER) {
      throw new BadRequestException(
        `El número de factura no puede superar ${MAX_INVOICE_NUMBER}`,
      );
    }
    return n;
  }

  /** Piso de la numeración automática de facturas (env, def 1). */
  private invoiceNumberFloor(): number {
    const raw = this.config.get<string>('INVOICE_NUMBER_START');
    const start = raw ? Number(raw) : 1;
    if (!Number.isFinite(start) || start < 1) return 1;
    return Math.trunc(start);
  }

  /**
   * Serializa la asignación de números de factura dentro de la transacción
   * (mismo patrón que `orders_seq`): sin él, dos facturaciones simultáneas
   * pueden leer el mismo "próximo libre" y una revienta contra el UNIQUE.
   */
  private async lockInvoiceNumbers(mgr: EntityManager): Promise<void> {
    await mgr.query(
      `SELECT pg_advisory_xact_lock(hashtext('order_invoices_number'))`,
    );
  }

  /**
   * Próximo N° de factura libre = el mayor EMITIDO + 1 (cuenta también las
   * anuladas: su número ya se usó y no vuelve). Es el valor por defecto del
   * Paso 4.
   */
  private async nextInvoiceNumber(mgr?: EntityManager): Promise<number> {
    const runner = mgr ?? this.dataSource.manager;
    const rows = await runner.query<{ next: string }[]>(
      `SELECT GREATEST(
         (SELECT COALESCE(MAX("number"), 0) + 1 FROM "order_invoices"),
         $1::bigint
       )::text AS next`,
      [String(this.invoiceNumberFloor())],
    );
    const next = Number(rows[0]?.next);
    if (!Number.isFinite(next)) {
      throw new BadRequestException(
        'No se pudo calcular el próximo número de factura',
      );
    }
    return next;
  }

  /**
   * Rechaza un N° de factura ya emitido. Los números NO se reutilizan: tampoco
   * los de las facturas anuladas (ese número ya salió impreso). `selfOrderId`
   * tolera el de la factura VIGENTE de la propia orden.
   */
  private async assertInvoiceNumberFree(
    mgr: EntityManager,
    number: number,
    selfOrderId?: string,
  ): Promise<void> {
    const rows = await mgr.query<
      { id: string; status: string; orderId: string; orderNumber: string }[]
    >(
      `SELECT i."id", i."status", i."orderId", o."orderNumber"
         FROM "order_invoices" i
         JOIN "orders" o ON o."id" = i."orderId"
        WHERE i."number" = $1::bigint
        LIMIT 1`,
      [String(number)],
    );
    const row = rows[0];
    if (!row) return;
    if (row.status === 'active' && selfOrderId && row.orderId === selfOrderId) {
      return;
    }
    throw new BadRequestException(
      row.status === 'cancelled'
        ? `El número de factura ${formatInvoiceNumber(number)} ya se usó en una factura anulada de la orden N° ${row.orderNumber}. Los números no se reutilizan.`
        : `El número de factura ${formatInvoiceNumber(number)} ya está en uso en la orden N° ${row.orderNumber}`,
    );
  }

  /**
   * Disponibilidad de un N° de factura para el Paso 4.
   *
   *  - `suggestion`: próximo libre (el mayor emitido + 1) = valor por defecto.
   *  - `available`: `false` si el número ya se emitió (vigente o anulado).
   *  - `cancelled`: el número lo tiene una factura ANULADA (tampoco se reusa).
   *  - `nextFree`: primer número libre ≥ el pedido.
   *  - `invoiceNumber` / `controlNumber`: cómo quedarían impresos.
   *
   * `orderId` no marca como ocupada la factura vigente de esa misma orden.
   */
  async invoiceNumberAvailability(opts: {
    number?: number;
    orderId?: string;
  }): Promise<{
    suggestion: number;
    number: number | null;
    available: boolean | null;
    cancelled: boolean;
    usedByOrderNumber: string | null;
    nextFree: number;
    invoiceNumber: string | null;
    controlNumber: string | null;
  }> {
    const suggestion = await this.nextInvoiceNumber();
    if (opts.number == null) {
      return {
        suggestion,
        number: null,
        available: null,
        cancelled: false,
        usedByOrderNumber: null,
        nextFree: suggestion,
        invoiceNumber: null,
        controlNumber: null,
      };
    }
    const number = this.assertInvoiceNumberRange(opts.number);
    const rows = await this.dataSource.manager.query<
      { status: string; orderId: string; orderNumber: string }[]
    >(
      `SELECT i."status", i."orderId", o."orderNumber"
         FROM "order_invoices" i
         JOIN "orders" o ON o."id" = i."orderId"
        WHERE i."number" = $1::bigint
        LIMIT 1`,
      [String(number)],
    );
    const row = rows[0];
    const isSelf =
      !!row &&
      row.status === 'active' &&
      !!opts.orderId &&
      row.orderId === opts.orderId;
    const available = !row || isSelf;
    const freeRows = available
      ? []
      : await this.dataSource.manager.query<{ g: string }[]>(
          `WITH taken AS (
             SELECT "number" AS n FROM "order_invoices"
              WHERE "number" IS NOT NULL AND "number" >= $1::bigint
           )
           SELECT g::text AS g
             FROM generate_series(
                    $1::bigint,
                    COALESCE((SELECT MAX(n) FROM taken), $1::bigint) + 1
                  ) AS g
            WHERE NOT EXISTS (SELECT 1 FROM taken t WHERE t.n = g)
            ORDER BY g
            LIMIT 1`,
          [String(number)],
        );
    const nextFree = available ? number : Number(freeRows[0]?.g ?? suggestion);
    return {
      suggestion,
      number,
      available,
      cancelled: !!row && row.status === 'cancelled',
      usedByOrderNumber: row && !isSelf ? row.orderNumber : null,
      nextFree: Number.isFinite(nextFree) ? nextFree : suggestion,
      invoiceNumber: formatInvoiceNumber(number),
      controlNumber: deriveControlNumber(number),
    };
  }

  /**
   * Emite una factura NUEVA para una orden ya finalizada cuya factura vigente
   * fue anulada. No toca la liquidación por proveedor ni las conversiones de
   * CxP/CxC ya cerradas: sólo la tasa con la que se IMPRIME el documento
   * (`invoiceExchangeRateId`).
   */
  async issueInvoice(
    id: string,
    dto: IssueOrderInvoiceDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    this.assertNotCancelled(order);
    if (order.status !== 'finalized') {
      throw new BadRequestException(
        'La orden todavía no está facturada: emite la factura desde el Paso 4.',
      );
    }
    const active = (order.invoices ?? []).find((i) => i.status === 'active');
    if (active) {
      throw new BadRequestException(
        `La orden ya tiene la factura N° ${active.invoiceNumber} vigente. Anúlala antes de emitir otra.`,
      );
    }
    const number = this.assertInvoiceNumberRange(dto.invoiceNumber);
    const invoiceDisplay = formatInvoiceNumber(number);
    const controlNumber = deriveControlNumber(number);
    const invoiceDate = (dto.invoiceDate ?? order.orderDate).slice(0, 10);
    const showExchangeRate =
      dto.showExchangeRate ?? order.invoiceShowExchangeRate ?? null;
    const rateId =
      dto.exchangeRateId ??
      order.invoiceExchangeRateId ??
      order.billingExchangeRateId ??
      null;
    if (dto.exchangeRateId) {
      await resolveUsdRate(this.ratesRepo, dto.exchangeRateId);
    }

    await this.dataSource.transaction(async (mgr) => {
      await this.lockInvoiceNumbers(mgr);
      await this.assertInvoiceNumberFree(mgr, number);
      await mgr.insert(OrderInvoice, {
        orderId: order.id,
        number: String(number),
        invoiceNumber: invoiceDisplay,
        controlNumber,
        invoiceDate,
        showExchangeRate,
        exchangeRateId: rateId,
        status: 'active',
        createdById: user.id,
      });
      await mgr.update(
        Order,
        { id: order.id },
        {
          invoiceNumber: invoiceDisplay,
          controlNumber,
          invoiceDate,
          invoiceShowExchangeRate: showExchangeRate,
          invoiceExchangeRateId: rateId,
        },
      );
      await this.logChange(mgr, order.id, user.id, 'invoice_issue', {
        invoiceNumber: { to: invoiceDisplay },
        controlNumber: { to: controlNumber },
        invoiceDate: { to: invoiceDate },
      });
    });
    return this.findOne(id, user);
  }

  /**
   * Anula una factura de la orden (NO la orden): queda el rastro con motivo,
   * autor y fecha, y su número se quema para siempre. Si era la vigente, la
   * orden queda sin factura hasta emitir otra.
   */
  async cancelInvoice(
    id: string,
    invoiceId: string,
    dto: CancelOrderInvoiceDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    const invoice = (order.invoices ?? []).find((i) => i.id === invoiceId);
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada en esta orden');
    }
    if (invoice.status === 'cancelled') {
      throw new BadRequestException('La factura ya está anulada');
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(
        OrderInvoice,
        { id: invoice.id },
        {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          cancelledById: user.id,
        },
      );
      // El espejo de la orden apunta a la factura vigente: al anularla queda
      // vacío (reportes y estado de cuenta dejan de mostrar ese número).
      if (order.invoiceNumber === invoice.invoiceNumber) {
        await mgr.update(
          Order,
          { id: order.id },
          {
            invoiceNumber: null,
            controlNumber: null,
            invoiceDate: null,
            invoiceShowExchangeRate: null,
            invoiceExchangeRateId: null,
          },
        );
      }
      await this.logChange(mgr, order.id, user.id, 'invoice_cancel', {
        invoiceNumber: { from: invoice.invoiceNumber, to: null },
        controlNumber: { from: invoice.controlNumber, to: null },
        cancelReason: { to: dto.reason },
      });
    });
    return this.findOne(id, user);
  }

  private async snapshotBuyerPricing(
    mgr: EntityManager,
    orderId: string,
    type: 'cash' | 'credit' | 'insurance' | 'cashea',
    insuranceId: string | null,
    serviceTypeIds: string[],
  ): Promise<void> {
    if (!serviceTypeIds.length) return;
    if (type === 'insurance' && insuranceId) {
      const rows = await mgr.getRepository(InsuranceServicePrice).find({
        where: { insuranceId, serviceTypeId: In(serviceTypeIds) },
      });
      const byST = new Map(rows.map((r) => [r.serviceTypeId, r]));
      const missing = serviceTypeIds.filter((id) => !byST.has(id));
      if (missing.length) {
        throw new BadRequestException(
          `El seguro seleccionado no tiene precio definido para algún tipo de servicio (${missing.length} pendiente${missing.length === 1 ? '' : 's'}). Carga los precios en el seguro o quita esos servicios.`,
        );
      }
      const values = serviceTypeIds.map((stId) => {
        const r = byST.get(stId)!;
        return {
          orderId,
          serviceTypeId: stId,
          kind: 'insurance' as const,
          priceUsd: r.priceUsd,
        };
      });
      await mgr.insert(OrderServicePricing, values);
    } else {
      const sts = await mgr.getRepository(ServiceType).find({
        where: { id: In(serviceTypeIds) },
      });
      const values = sts.map((st) => ({
        orderId,
        serviceTypeId: st.id,
        kind: 'particular' as const,
        priceUsd: st.particularPriceUsd ?? '0',
      }));
      if (values.length) await mgr.insert(OrderServicePricing, values);
    }
  }

  /**
   * Sugerido + snapshots para los STs de un proveedor en una moneda.
   * STs sin precio definido omitidos del sugerido.
   */
  private async computeProviderPricing(
    providerType: 'doctor' | 'care_center',
    providerId: string,
    serviceTypeIds: string[],
    qtyByST?: Map<string, number>,
  ): Promise<{
    suggested: number;
    snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }>;
  }> {
    if (!serviceTypeIds.length) return { suggested: 0, snapshotRows: [] };

    const rows =
      providerType === 'doctor'
        ? await this.doctorPricesRepo.find({
            where: { doctorId: providerId, serviceTypeId: In(serviceTypeIds) },
          })
        : await this.careCenterPricesRepo.find({
            where: {
              careCenterId: providerId,
              serviceTypeId: In(serviceTypeIds),
            },
          });

    let suggested = 0;
    const snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }> = [];
    for (const r of rows) {
      const amount = Number(r.priceUsd);
      const qty = Math.max(1, Math.trunc(qtyByST?.get(r.serviceTypeId) ?? 1));
      if (Number.isFinite(amount)) suggested += amount * qty;
      snapshotRows.push({
        orderId: '',
        serviceTypeId: r.serviceTypeId,
        kind: providerType,
        priceUsd: r.priceUsd,
      });
    }
    return { suggested: +suggested.toFixed(2), snapshotRows };
  }

  /**
   * Diff campo a campo para el historial de cambios de una edición del Paso 1.
   * Compara la orden existente contra los valores EFECTIVOS que se escriben en
   * la transacción (post-normalización: serviceKey trim/null, reembolso solo
   * crédito, cashea/tasa fija derivados). Las relaciones to-many (STs,
   * patologías, pagos) se comparan normalizadas y se reportan como conteos.
   */
  private diffUpdateChanges(
    existing: Order,
    merged: CreateOrderDto,
    fin: {
      insuranceSource: string | null;
      serviceKey: string | null;
      isReimbursement: boolean;
      /** Valor efectivo post-normalización ("123.00" | null). */
      casheaFirstInstallmentAmount: string | null;
      useFixedRate: boolean;
      fixedExchangeRateId: string | null;
      /** Monto base efectivo ("123.00") y motivo del ajuste post-normalización. */
      priceBaseAmount: string;
      priceAdjustmentNote: string | null;
      /** Especialidad principal derivada de la primera fila ST. */
      specialtyId: string;
      dtoPayments?: CreateOrderPaymentDto[];
    },
  ): Record<string, { from?: unknown; to?: unknown }> {
    const out: Record<string, { from?: unknown; to?: unknown }> = {};
    const put = (k: string, from: unknown, to: unknown) => {
      if (from !== to) out[k] = { from, to };
    };

    put('branchId', existing.branchId, merged.branchId);
    put('type', existing.type, merged.type);
    put('holderId', existing.holderId, merged.holderId);
    put('patientId', existing.patientId, merged.patientId);
    put(
      'contractorId',
      existing.contractorId ?? null,
      merged.contractorId ?? null,
    );
    put(
      'insuranceId',
      existing.insuranceId ?? null,
      merged.insuranceId ?? null,
    );
    put(
      'insuranceSource',
      existing.insuranceSource ?? null,
      fin.insuranceSource,
    );
    put('serviceKey', existing.serviceKey ?? null, fin.serviceKey);
    put('isReimbursement', existing.isReimbursement, fin.isReimbursement);
    put('specialtyId', existing.specialtyId, fin.specialtyId);
    put(
      'orderDate',
      String(existing.orderDate).slice(0, 10),
      String(merged.orderDate).slice(0, 10),
    );
    put(
      'appointmentDate',
      existing.appointmentDate.toISOString(),
      new Date(merged.appointmentDate).toISOString(),
    );
    put(
      'priceAmount',
      Number(existing.priceAmount),
      +merged.priceAmount.toFixed(2),
    );
    put(
      'priceBaseAmount',
      existing.priceBaseAmount != null
        ? Number(existing.priceBaseAmount)
        : null,
      Number(fin.priceBaseAmount),
    );
    put(
      'priceAdjustmentNote',
      existing.priceAdjustmentNote ?? null,
      fin.priceAdjustmentNote,
    );
    put(
      'casheaFirstInstallmentAmount',
      existing.casheaFirstInstallmentAmount != null
        ? Number(existing.casheaFirstInstallmentAmount)
        : null,
      fin.casheaFirstInstallmentAmount != null
        ? Number(fin.casheaFirstInstallmentAmount)
        : null,
    );
    put('useFixedRate', existing.useFixedRate, fin.useFixedRate);
    put(
      'fixedExchangeRateId',
      existing.fixedExchangeRateId ?? null,
      fin.fixedExchangeRateId,
    );

    // Filas ST normalizadas (id|proveedor|cantidad|nombre|indexado); orden irrelevante.
    const normRow = (r: {
      serviceTypeId: string;
      providerType: 'doctor' | 'care_center';
      specialtyId?: string | null;
      doctorId?: string | null;
      careCenterId?: string | null;
      quantity?: number | null;
      customName?: string | null;
      isIndexed?: boolean | null;
    }) =>
      [
        r.serviceTypeId,
        r.providerType,
        r.specialtyId ?? '',
        r.providerType === 'doctor'
          ? (r.doctorId ?? '')
          : (r.careCenterId ?? ''),
        Math.max(1, Math.trunc(r.quantity ?? 1)),
        (r.customName ?? '').trim(),
        r.isIndexed ? '1' : '0',
      ].join('|');
    const fromRows = (existing.orderServiceTypes ?? []).map(normRow).sort();
    const toRows = merged.serviceTypes
      .map((r) =>
        normRow({ ...r, isIndexed: fin.useFixedRate ? !!r.isIndexed : false }),
      )
      .sort();
    if (fromRows.join(';') !== toRows.join(';')) {
      out.serviceTypes = { from: fromRows.length, to: toRows.length };
    }

    const fromPath = (existing.pathologies ?? []).map((p) => p.id).sort();
    const toPath = Array.from(new Set(merged.pathologyIds ?? [])).sort();
    if (fromPath.join(';') !== toPath.join(';')) {
      out.pathologies = { from: fromPath.length, to: toPath.length };
    }

    // Pagos: replace-all cuando el dto los trae; si el tipo deja de admitirlos
    // (crédito/seguro) se limpian aunque no vengan en el dto.
    const paysAllowed = merged.type === 'cash' || merged.type === 'cashea';
    const normPay = (p: {
      type: string;
      paymentDate: string | Date;
      amountCurrency: string;
      amountValue: string | number;
      referenceNumber?: string | null;
    }) =>
      [
        p.type,
        String(p.paymentDate).slice(0, 10),
        p.amountCurrency,
        Number(p.amountValue).toFixed(2),
        p.referenceNumber ?? '',
      ].join('|');
    const fromPays = (existing.payments ?? []).map(normPay).sort();
    if (fin.dtoPayments !== undefined) {
      const toPays = (paysAllowed ? fin.dtoPayments : []).map(normPay).sort();
      if (fromPays.join(';') !== toPays.join(';')) {
        out.payments = { from: fromPays.length, to: toPays.length };
      }
    } else if (!paysAllowed && fromPays.length > 0) {
      out.payments = { from: fromPays.length, to: 0 };
    }

    return out;
  }

  async update(
    id: string,
    dto: UpdateOrderDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const existing = await this.findOne(id, user);
    this.assertNotCancelled(existing);
    if (existing.status !== 'draft')
      throw new BadRequestException(
        'Solo se puede editar el Paso 1 de una orden creada (antes de atenderla)',
      );
    this.assertStep1Editable(existing, user);

    // Número de orden. `undefined` = no tocar la numeración; sólo se puede
    // cambiar mientras la orden siga en borrador y con el permiso dedicado.
    const customNumber = dto.customOrderNumber ?? null;
    if (
      customNumber != null &&
      String(customNumber) !== existing.orderNumber &&
      !this.userHasPermission(user, PERMISSIONS.ORDERS.CUSTOM_NUMBER)
    ) {
      throw new ForbiddenException(
        'No tienes permiso para cambiar el número de orden',
      );
    }
    if (customNumber != null) {
      this.assertOrderNumberRange(customNumber);
    }

    const existingPathologyIds = (existing.pathologies ?? []).map((p) => p.id);
    const existingRows: OrderServiceTypeRowDto[] = (
      existing.orderServiceTypes ?? []
    ).map((ost) => ({
      serviceTypeId: ost.serviceTypeId,
      providerType: ost.providerType,
      specialtyId: ost.specialtyId,
      doctorId: ost.doctorId ?? undefined,
      careCenterId: ost.careCenterId ?? undefined,
      quantity: ost.quantity ?? 1,
      customName: ost.customName ?? '',
      isIndexed: ost.isIndexed,
    }));

    const merged: CreateOrderDto = {
      branchId: dto.branchId ?? existing.branchId,
      type: (dto.type ?? existing.type) as CreateOrderDto['type'],
      holderId: dto.holderId ?? existing.holderId,
      patientId: dto.patientId ?? existing.patientId,
      contractorId: dto.contractorId ?? existing.contractorId ?? undefined,
      insuranceId: dto.insuranceId ?? existing.insuranceId ?? undefined,
      insuranceSource: (dto.insuranceSource ??
        existing.insuranceSource ??
        undefined) as 'direct' | 'via_contractor' | undefined,
      serviceKey:
        dto.serviceKey !== undefined
          ? dto.serviceKey
          : (existing.serviceKey ?? undefined),
      isReimbursement:
        dto.isReimbursement !== undefined
          ? dto.isReimbursement
          : existing.isReimbursement,
      serviceTypes: dto.serviceTypes ?? existingRows,
      pathologyIds: dto.pathologyIds ?? existingPathologyIds,
      orderDate: dto.orderDate ?? existing.orderDate,
      appointmentDate:
        dto.appointmentDate ?? existing.appointmentDate.toISOString(),
      priceAmount: dto.priceAmount ?? Number(existing.priceAmount),
      casheaFirstInstallmentAmount:
        dto.casheaFirstInstallmentAmount ??
        (existing.casheaFirstInstallmentAmount != null
          ? Number(existing.casheaFirstInstallmentAmount)
          : undefined),
      fixedExchangeRateId:
        dto.fixedExchangeRateId ?? existing.fixedExchangeRateId ?? undefined,
    };
    await this.validateCoreReferences(merged, user, {
      // Pares proveedor↔especialidad que la orden ya tenía guardados: no se
      // revalidan (las órdenes previas a la especialidad por fila heredaron la
      // principal sin chequear que el proveedor la tuviera).
      grandfatheredProviderSpecialties: new Set(
        (existing.orderServiceTypes ?? []).map((ost) =>
          providerSpecialtyKey(ost),
        ),
      ),
    });

    // Especialidad principal derivada: la de la primera fila ST (la especialidad
    // real vive por fila; la orden guarda la principal para filtro/reportes).
    const mergedSpecialtyId = this.primarySpecialtyId(merged.serviceTypes);

    // Tasa fija derivada del seguro (isIndexed=true, UI "No indexado"). La tasa
    // definitiva la elige el Paso 4 con la de la factura; aquí queda provisional.
    const fixedUpd = await this.resolveFixedRate(
      merged.type,
      merged.insuranceId ?? null,
      merged.fixedExchangeRateId ?? null,
      merged.orderDate,
    );

    // Monto base (catálogo) + ajuste con motivo. Sin orders.edit-amount el
    // monto se fuerza al base (salvo monto ya autorizado por un validador).
    const priceAdjUpd = await this.resolvePriceAdjustment(
      {
        type: merged.type,
        insuranceId: merged.insuranceId ?? null,
        rows: merged.serviceTypes,
        requestedAmount: merged.priceAmount,
        note: dto.priceAdjustmentNote,
        existing,
      },
      user,
    );
    merged.priceAmount = priceAdjUpd.priceAmount;

    // Snapshot Cashea: si pasa a cashea desde otro tipo, capturar tasas de la
    // config global; si ya era cashea, preservar tasas snapshot y sólo actualizar
    // el monto de la inicial; si deja de ser cashea, limpiar los tres campos.
    // `undefined` = no tocar.
    let nextCashea:
      | {
          casheaFirstInstallmentAmount: string;
          casheaCommissionRate: string;
          casheaFinancingRate: string;
        }
      | null
      | undefined = undefined;
    if (merged.type === 'cashea') {
      const firstAmount = merged.casheaFirstInstallmentAmount ?? 0;
      if (firstAmount >= merged.priceAmount) {
        throw new BadRequestException(
          'La inicial Cashea debe ser menor al precio total de la orden',
        );
      }
      let commissionRate: string;
      let financingRate: string;
      if (existing.type === 'cashea') {
        // Preservar snapshot de tasas; sólo cambia el monto de la inicial.
        const cfg = await this.appConfig.getCasheaCommissionConfig();
        commissionRate =
          existing.casheaCommissionRate ?? cfg.commissionRate.toFixed(4);
        financingRate =
          existing.casheaFinancingRate ?? cfg.financingRate.toFixed(4);
      } else {
        const cfg = await this.appConfig.getCasheaCommissionConfig();
        commissionRate = cfg.commissionRate.toFixed(4);
        financingRate = cfg.financingRate.toFixed(4);
      }
      nextCashea = {
        casheaFirstInstallmentAmount: firstAmount.toFixed(2),
        casheaCommissionRate: commissionRate,
        casheaFinancingRate: financingRate,
      };
    } else if (existing.type === 'cashea') {
      nextCashea = null;
    }

    // Regla de pago Paso 1 (la orden sigue en borrador). Pagos efectivos =
    // nuevos si se reemplazan, sino los snapshot existentes (amountInUsd).
    const updSumUsd =
      merged.type === 'cash' || merged.type === 'cashea'
        ? dto.payments !== undefined
          ? await this.sumPaymentsUsd(dto.payments)
          : Math.round(
              (existing.payments ?? []).reduce(
                (s, p) => s + Number(p.amountInUsd || 0),
                0,
              ) * 100,
            ) / 100
        : 0;
    this.assertStep1Payments(
      merged.type,
      updSumUsd,
      merged.priceAmount,
      merged.casheaFirstInstallmentAmount,
    );

    // Diff para el historial de cambios (valores efectivos post-normalización,
    // los mismos que se escriben abajo en la transacción).
    const changes = this.diffUpdateChanges(existing, merged, {
      insuranceSource:
        merged.type === 'insurance' ? (merged.insuranceSource ?? null) : null,
      serviceKey:
        merged.type === 'insurance' && merged.serviceKey?.trim()
          ? merged.serviceKey.trim()
          : null,
      isReimbursement:
        merged.type === 'credit' ? !!merged.isReimbursement : false,
      casheaFirstInstallmentAmount:
        nextCashea !== undefined
          ? nextCashea === null
            ? null
            : nextCashea.casheaFirstInstallmentAmount
          : (existing.casheaFirstInstallmentAmount ?? null),
      useFixedRate: fixedUpd.useFixedRate,
      fixedExchangeRateId: fixedUpd.fixedExchangeRateId,
      priceBaseAmount: priceAdjUpd.priceBaseAmount,
      priceAdjustmentNote: priceAdjUpd.priceAdjustmentNote,
      specialtyId: mergedSpecialtyId,
      dtoPayments: dto.payments,
    });
    if (customNumber != null && String(customNumber) !== existing.orderNumber) {
      changes.orderNumber = {
        from: existing.orderNumber,
        to: String(customNumber),
      };
    }

    const mergedServiceKey =
      merged.type === 'insurance' && merged.serviceKey?.trim()
        ? merged.serviceKey.trim()
        : null;

    // Sólo se valida si la clave CAMBIA: una orden vieja con clave repetida
    // (datos previos a la regla) tiene que poder seguir editándose.
    const serviceKeyChanged = mergedServiceKey !== (existing.serviceKey ?? null);

    await this.dataSource.transaction(async (mgr) => {
      // Clave de servicio no repetida entre órdenes vivas (la propia se excluye).
      if (serviceKeyChanged) {
        await this.assertServiceKeyAvailable(mgr, mergedServiceKey, existing.id);
      }
      // Importante: NO usar `Object.assign(existing, …)` + `mgr.save(existing)`
      // — la orden viene con las relaciones cargadas (patient/holder/branch/…)
      // y TypeORM deriva las columnas FK del objeto relación, ignorando los IDs
      // reasignados (el cambio de paciente/titular/etc. se perdía en silencio).
      await mgr.update(Order, existing.id, {
        branchId: merged.branchId,
        type: merged.type,
        holderId: merged.holderId,
        patientId: merged.patientId,
        contractorId: merged.contractorId ?? null,
        insuranceId: merged.insuranceId ?? null,
        insuranceSource:
          merged.type === 'insurance' ? (merged.insuranceSource ?? null) : null,
        serviceKey: mergedServiceKey,
        isReimbursement:
          merged.type === 'credit' ? !!merged.isReimbursement : false,
        specialtyId: mergedSpecialtyId,
        orderDate: merged.orderDate,
        appointmentDate: new Date(merged.appointmentDate),
        priceAmount: merged.priceAmount.toFixed(2),
        priceBaseAmount: priceAdjUpd.priceBaseAmount,
        priceAdjustmentNote: priceAdjUpd.priceAdjustmentNote,
        priceAdjustedById: priceAdjUpd.priceAdjustedById,
        priceAdjustedAt: priceAdjUpd.priceAdjustedAt,
        ...(nextCashea !== undefined
          ? nextCashea === null
            ? {
                casheaFirstInstallmentAmount: null,
                casheaCommissionRate: null,
                casheaFinancingRate: null,
              }
            : nextCashea
          : {}),
        useFixedRate: fixedUpd.useFixedRate,
        fixedExchangeRateId: fixedUpd.fixedExchangeRateId,
      });

      // Reconciliar OST + órdenes internas. Orden FK-safe (OST→interna es CASCADE):
      //   1) borrar todas las OST (libera las referencias a las internas),
      //   2) reconciliar order_internal_orders (sobrevive/quema/agrega número),
      //   3) reinsertar OST ligadas a su orden interna.
      // Proveedor agregado a una orden ya numerada: toma el primer número libre
      // después del BASE, para que las órdenes internas de la orden queden
      // contiguas (y se rellenen sus propios huecos) en vez de saltar a la marca
      // de agua global.
      const currentBase = Number(existing.orderNumber);
      const contiguousBase =
        customNumber ?? (Number.isFinite(currentBase) ? currentBase : null);
      const distinct = this.distinctProvidersFromRows(merged.serviceTypes);
      await mgr.delete(OrderServiceType, { orderId: existing.id });
      const iioByKey = await this.reconcileInternalOrders(
        mgr,
        existing.id,
        distinct,
        contiguousBase,
      );
      await this.persistOrderServiceTypes(
        mgr,
        existing.id,
        merged.serviceTypes,
        iioByKey,
        fixedUpd.useFixedRate,
      );

      // Cambio de número manual: renumera la orden completa (base + proveedores).
      if (
        customNumber != null &&
        String(customNumber) !== existing.orderNumber
      ) {
        await this.renumberOrder(mgr, existing.id, customNumber);
      }

      // Pathologies replace.
      const pRel = mgr
        .createQueryBuilder()
        .relation(Order, 'pathologies')
        .of(existing.id);
      if (existingPathologyIds.length) await pRel.remove(existingPathologyIds);
      if (merged.pathologyIds && merged.pathologyIds.length)
        await pRel.add(Array.from(new Set(merged.pathologyIds)));

      if (dto.payments !== undefined) {
        await mgr.delete(OrderPayment, { orderId: existing.id });
        if (
          (merged.type === 'cash' || merged.type === 'cashea') &&
          dto.payments.length
        ) {
          for (const p of dto.payments) {
            const payload = await this.resolvePaymentForSave(p, null);
            await mgr.save(
              mgr.create(OrderPayment, { ...payload, orderId: existing.id }),
            );
          }
        }
      } else if (merged.type !== 'cash' && merged.type !== 'cashea') {
        // Cambió a crédito/seguro sin reenviar pagos: limpiar pagos previos.
        await mgr.delete(OrderPayment, { orderId: existing.id });
      }

      // Re-snapshot buyer pricing.
      await mgr.delete(OrderServicePricing, {
        orderId: existing.id,
        kind: In(['particular', 'insurance']),
      });
      await this.snapshotBuyerPricing(
        mgr,
        existing.id,
        merged.type,
        merged.insuranceId ?? null,
        merged.serviceTypes.map((r) => r.serviceTypeId),
      );

      // Modelo Pendientes + Lotes: no hay cuentas por pagar/cobrar ligadas a la
      // orden que reconciliar. La edición sólo ocurre en borrador y los montos a
      // proveedor (pendientes) se escriben al facturar; un borrador nunca tiene
      // órdenes internas dentro de un lote.

      if (Object.keys(changes).length) {
        await this.logChange(mgr, existing.id, user.id, 'update', changes);
      }
    });

    return this.findOne(existing.id, user);
  }

  /**
   * Soft-delete de la orden. En el modelo Pendientes + Lotes las cuentas por
   * pagar/cobrar no cuelgan de la orden, así que no hay cascada: en cambio se
   * BLOQUEA el borrado si alguna orden interna de esta orden ya está dentro de
   * un lote de pago, o la orden está dentro de un lote de cobro (anular el lote
   * primero evita pivots colgantes o totales que se encojan).
   */
  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.assertNotInBatch(id);
    await this.repo.update({ id }, { deletedAt: new Date() });
    await this.logChange(null, id, user.id, 'soft_delete');
  }

  /**
   * Lanza si la orden participa en un lote de cuentas por pagar/cobrar.
   * `action` es el verbo que se muestra en el mensaje ("eliminar", "cancelar").
   */
  private async assertNotInBatch(
    orderId: string,
    action = 'eliminar',
  ): Promise<void> {
    const inPayable = await this.dataSource.query<{ c: string }[]>(
      `SELECT count(*)::int AS c
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       WHERE iio."orderId" = $1`,
      [orderId],
    );
    const inReceivable = await this.dataSource.query<{ c: string }[]>(
      `SELECT count(*)::int AS c FROM "accounts_receivable_orders" WHERE "orderId" = $1`,
      [orderId],
    );
    if (
      Number(inPayable[0]?.c ?? 0) > 0 ||
      Number(inReceivable[0]?.c ?? 0) > 0
    ) {
      throw new BadRequestException(
        `La orden está incluida en un lote de cuentas por pagar/cobrar. Anula el lote antes de ${action} la orden.`,
      );
    }
  }

  /**
   * Hard-delete: borra la orden y sus órdenes internas (CASCADE). Sus números
   * NO se reciclan: quedan como hueco definitivo y la numeración sigue desde el
   * último emitido (`orders_seq` sólo avanza).
   */
  async hardDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user, true);
    await this.assertNotInBatch(id);
    await this.repo.delete(id);
  }

  async restore(id: string, user: AuthenticatedUser): Promise<Order> {
    const order = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!order) throw new NotFoundException('Orden no encontrada');
    await this.assertBranchVisibility(order.branchId, user);
    if (!order.deletedAt) return this.findOne(id, user);
    await this.repo.update({ id }, { deletedAt: null });
    await this.logChange(null, id, user.id, 'restore');
    return this.findOne(id, user);
  }

  /**
   * Cambia el N° de orden de una orden YA CREADA (Paso 1), en cualquier estado
   * del flujo: el número pasa a ser el BASE y los proveedores toman el bloque
   * consecutivo `[number, number + K - 1]` (`renumberOrder`), que debe estar
   * libre. No aplica a órdenes canceladas (el flujo está congelado) y respeta
   * el candado del Paso 1 (sólo el creador o Super Admin).
   *
   * Los lotes de cuentas por pagar/cobrar referencian la orden por id, no por
   * número, así que renumerar no los rompe: sólo cambia lo que muestran.
   */
  async changeNumber(
    id: string,
    dto: ChangeOrderNumberDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    this.assertNotCancelled(order);
    this.assertStep1Editable(order, user);
    const base = this.assertOrderNumberRange(dto.number);
    if (String(base) === order.orderNumber) return order;
    await this.dataSource.transaction(async (mgr) => {
      await this.renumberOrder(mgr, order.id, base);
    });
    await this.logChange(null, order.id, user.id, 'update', {
      orderNumber: { from: order.orderNumber, to: String(base) },
    });
    return this.findOne(id, user);
  }

  /**
   * Lanza si la orden está cancelada. La cancelación congela el flujo: hay que
   * reactivarla antes de atender, informar, facturar o editar.
   */
  private assertNotCancelled(order: Order): void {
    if (order.status === 'cancelled') {
      throw new BadRequestException(
        'La orden está cancelada. Reactívala para continuar con el flujo.',
      );
    }
  }

  /**
   * Cancela la orden: conserva su número y todo su contenido, pero la saca del
   * flujo (no se puede editar, atender, informar ni facturar). Es la
   * alternativa al borrado para no abrir huecos en la numeración.
   *
   * Aplica a CUALQUIER estado, `finalized` incluido (una orden ya facturada
   * también se puede anular). Al cancelarla desaparece de pendientes y reportes
   * (todos filtran `status='finalized'`). Lo único que sigue bloqueado es una
   * orden ya metida en un lote de cuentas por pagar/cobrar: hay que anular el
   * lote primero para no dejar el lote apuntando a una orden fuera de circuito.
   * Guarda el estado previo para poder revertir con {@link uncancel}.
   *
   * Además LIBERA sus números: la orden los sigue mostrando, pero se pueden
   * volver a elegir a mano en otra orden (los UNIQUE de `orderNumber` /
   * `internalNumber` son parciales sobre las órdenes vivas; el espejo
   * `order_internal_orders.cancelled` se escribe en la misma transacción).
   */
  async cancel(
    id: string,
    dto: CancelOrderDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    if (order.status === 'cancelled') {
      throw new BadRequestException('La orden ya está cancelada');
    }
    await this.assertNotInBatch(id, 'cancelar');
    const reason = dto.reason.trim();
    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(Order).update(
        { id: order.id },
        {
          status: 'cancelled',
          statusBeforeCancel: order.status,
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancelReason: reason,
        },
      );
      await mgr.query(
        `UPDATE "order_internal_orders" SET "cancelled" = true WHERE "orderId" = $1`,
        [order.id],
      );
    });
    await this.logChange(null, order.id, user.id, 'cancel', {
      status: { from: order.status, to: 'cancelled' },
      cancelReason: { to: reason },
    });
    return this.findOne(id, user);
  }

  /**
   * Revierte la cancelación: la orden vuelve al estado que tenía antes de
   * cancelarse (`draft` si no hay snapshot — órdenes canceladas antes de la
   * migración) y se limpian las columnas de cancelación. El rastro queda en el
   * historial (`cancel` / `uncancel`).
   *
   * Sus números volvieron a estar "en uso", así que primero se verifica que
   * nadie los haya tomado mientras estuvo cancelada. Si alguno está ocupado se
   * rechaza diciendo qué orden lo tiene: nada se renumera solo (la orden pudo
   * haber salido impresa con ese número).
   */
  async uncancel(id: string, user: AuthenticatedUser): Promise<Order> {
    const order = await this.findOne(id, user);
    if (order.status !== 'cancelled') {
      throw new BadRequestException('La orden no está cancelada');
    }
    const restored: OrderStatus = order.statusBeforeCancel ?? 'draft';
    await this.dataSource.transaction(async (mgr) => {
      // Mismo lock que el reparto de números: evita reactivar y crear en paralelo.
      await mgr.query("SELECT pg_advisory_xact_lock(hashtext('orders_seq'))");
      const clashes = await this.numbersTakenByOthers(mgr, order.id);
      if (clashes.length) {
        const detail = clashes
          .map((c) => `${c.number} (orden N° ${c.takenBy})`)
          .join(', ');
        throw new BadRequestException(
          clashes.length === 1
            ? `No puedes reactivar la orden: su N° ${detail} ya lo tiene otra orden. Cambia el número de esa orden y vuelve a intentarlo.`
            : `No puedes reactivar la orden: sus números ya los tienen otras órdenes — ${detail}. Cambia el número de esas órdenes y vuelve a intentarlo.`,
        );
      }
      // La clave de servicio NO bloquea reactivar: la orden ya la traía y
      // reactivar no la reescribe (si otra orden la tomó mientras tanto,
      // quedan repetidas — igual que los duplicados históricos). Sin índice
      // único en la base, bloquear aquí sólo dejaría la orden atascada: una
      // cancelada tampoco se puede editar para cambiarle la clave.
      await mgr.getRepository(Order).update(
        { id: order.id },
        {
          status: restored,
          statusBeforeCancel: null,
          cancelledAt: null,
          cancelledById: null,
          cancelReason: null,
        },
      );
      await mgr.query(
        `UPDATE "order_internal_orders" SET "cancelled" = false WHERE "orderId" = $1`,
        [order.id],
      );
    });
    await this.logChange(null, order.id, user.id, 'uncancel', {
      status: { from: 'cancelled', to: restored },
    });
    return this.findOne(id, user);
  }

  /**
   * Números de la orden (base + órdenes internas) que hoy tiene OTRA orden viva.
   * Sólo puede pasar con una orden cancelada: al cancelarla sus números quedaron
   * libres. `takenBy` = número base de la orden que lo tomó.
   */
  private async numbersTakenByOthers(
    mgr: EntityManager,
    orderId: string,
  ): Promise<Array<{ number: string; takenBy: string }>> {
    return mgr.query<Array<{ number: string; takenBy: string }>>(
      `WITH mine AS (
         SELECT "internalNumber" AS n
           FROM "order_internal_orders" WHERE "orderId" = $1
         UNION
         SELECT "orderNumber" FROM "orders" WHERE id = $1
       )
       SELECT m.n AS "number", t."takenBy" AS "takenBy"
         FROM mine m
         CROSS JOIN LATERAL (
           SELECT COALESCE(
             (SELECT o2."orderNumber"
                FROM "order_internal_orders" iio
                JOIN "orders" o2 ON o2.id = iio."orderId"
               WHERE iio."internalNumber" = m.n
                 AND iio."cancelled" = false
                 AND iio."orderId" <> $1
               LIMIT 1),
             (SELECT o3."orderNumber" FROM "orders" o3
               WHERE o3."orderNumber" = m.n
                 AND o3.status <> 'cancelled'
                 AND o3.id <> $1
               LIMIT 1)
           ) AS "takenBy"
         ) t
        WHERE t."takenBy" IS NOT NULL
        ORDER BY CASE WHEN m.n ~ '^[0-9]+$' THEN m.n::bigint ELSE 0 END`,
      [orderId],
    );
  }

  // ------- Payments subresource -------

  async addPayment(
    orderId: string,
    dto: CreateOrderPaymentDto,
    user: AuthenticatedUser,
  ): Promise<OrderPayment> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException(
        'Solo se permiten pagos en el Paso 1 (orden creada, sin atender)',
      );
    if (order.type !== 'cash')
      throw new BadRequestException(
        'Solo se admiten pagos para órdenes de tipo Contado',
      );
    this.assertStep1Editable(order, user);
    const payload = await this.resolvePaymentForSave(
      dto,
      order.billingExchangeRateId ?? null,
    );
    const entity = this.paymentsRepo.create({ ...payload, orderId });
    const saved = await this.paymentsRepo.save(entity);
    await this.logChange(null, orderId, user.id, 'payment_add', {
      payment: { to: paymentSummary(dto) },
    });
    return saved;
  }

  async updatePayment(
    orderId: string,
    paymentId: string,
    dto: UpdateOrderPaymentDto,
    user: AuthenticatedUser,
  ): Promise<OrderPayment> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException(
        'Solo se permiten pagos en el Paso 1 (orden creada, sin atender)',
      );
    this.assertStep1Editable(order, user);
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId, orderId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const before = paymentSummary(payment);
    const merged: CreateOrderPaymentDto = {
      type: (dto.type ?? payment.type) as CreateOrderPaymentDto['type'],
      paymentDate: dto.paymentDate ?? payment.paymentDate,
      referenceNumber:
        dto.referenceNumber ?? payment.referenceNumber ?? undefined,
      bankCode: dto.bankCode ?? payment.bankCode ?? undefined,
      accountNumber: dto.accountNumber ?? payment.accountNumber ?? undefined,
      exchangeRateId: dto.exchangeRateId ?? payment.exchangeRateId ?? undefined,
      amountCurrency: (dto.amountCurrency ??
        payment.amountCurrency) as CreateOrderPaymentDto['amountCurrency'],
      amountValue: dto.amountValue ?? Number(payment.amountValue),
    };
    const payload = await this.resolvePaymentForSave(
      merged,
      order.billingExchangeRateId ?? null,
    );
    Object.assign(payment, payload);
    const saved = await this.paymentsRepo.save(payment);
    const after = paymentSummary(saved);
    if (before !== after) {
      await this.logChange(null, orderId, user.id, 'payment_update', {
        payment: { from: before, to: after },
      });
    }
    return saved;
  }

  async removePayment(
    orderId: string,
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException(
        'Solo se permiten cambios de pagos en el Paso 1 (orden creada, sin atender)',
      );
    this.assertStep1Editable(order, user);
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId, orderId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    await this.paymentsRepo.delete(paymentId);
    await this.logChange(null, orderId, user.id, 'payment_remove', {
      payment: { from: paymentSummary(payment) },
    });
  }
}

void In;

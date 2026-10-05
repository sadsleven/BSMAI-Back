import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetServiceType } from './entities/budget-service-type.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Pathology } from '../pathologies/entities/pathology.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { InsuranceServicePrice } from '../insurances/entities/insurance-service-price.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { QueryBudgetsDto } from './dto/query-budgets.dto';
import { ChangeBudgetStatusDto } from './dto/change-budget-status.dto';
import { BudgetServiceTypeRowDto } from './dto/budget-service-type.dto';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { paginateBuilder } from '../shared/utils/paginate';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';

/** Hoy en formato `YYYY-MM-DD` según la hora local del servidor. */
function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly repo: Repository<Budget>,
    @InjectRepository(BudgetServiceType)
    private readonly rowsRepo: Repository<BudgetServiceType>,
    @InjectRepository(Branch)
    private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Patient)
    private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Pathology)
    private readonly pathologiesRepo: Repository<Pathology>,
    @InjectRepository(ServiceType)
    private readonly serviceTypesRepo: Repository<ServiceType>,
    @InjectRepository(InsuranceServicePrice)
    private readonly insurancePricesRepo: Repository<InsuranceServicePrice>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private userHasPermission(user: AuthenticatedUser, perm: string): boolean {
    if (user.isSuperAdmin) return true;
    return (user.permissions ?? []).includes(perm);
  }

  /** Sucursales que el usuario puede ver (todas las activas si es superadmin). */
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
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('b.id', 'id')
      .from('user_branches', 'ub')
      .innerJoin('branches', 'b', 'b.id = ub."branchId"')
      .where('ub."userId" = :uid', { uid: user.id })
      .andWhere('b."isActive" = true')
      .andWhere('b."deletedAt" IS NULL')
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  private async assertBranchVisible(
    branchId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(branchId)) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
  }

  /** Relaciones que necesita el detalle y la exportación del documento. */
  private budgetRelations(): string[] {
    return [
      'branch',
      'holder',
      'holder.phones',
      'patient',
      'patient.phones',
      'insurance',
      'insurance.phones',
      'contractor',
      'specialty',
      'pathologies',
      'exchangeRate',
      'paymentAccount',
      'createdBy',
      'convertedOrder',
      'budgetServiceTypes',
      'budgetServiceTypes.serviceType',
      'budgetServiceTypes.specialty',
      'budgetServiceTypes.doctor',
      'budgetServiceTypes.careCenter',
    ];
  }

  /**
   * Marca `expired` (transient) y ordena las líneas por `position`: TypeORM no
   * garantiza el orden de una relación to-many y el documento debe imprimir los
   * servicios como se capturaron.
   */
  private decorate(budget: Budget): Budget {
    const today = todayIso();
    budget.expired =
      (budget.status === 'draft' || budget.status === 'sent') &&
      !!budget.validUntilDate &&
      budget.validUntilDate < today;
    if (budget.budgetServiceTypes) {
      budget.budgetServiceTypes.sort((a, b) => a.position - b.position);
    }
    return budget;
  }

  /** Piso del correlativo de presupuestos: `BUDGET_NUMBER_START` (def 1). */
  private budgetNumberFloor(): number {
    const raw = this.config.get<string>('BUDGET_NUMBER_START');
    const start = raw ? Number(raw) : 1;
    if (!Number.isFinite(start) || start < 1) return 1;
    return Math.trunc(start);
  }

  /** `P-00123`. El número impreso se persiste junto al valor numérico. */
  private formatBudgetNumber(n: number): string {
    return `P-${String(n).padStart(5, '0')}`;
  }

  /**
   * Siguiente correlativo libre. Como en las órdenes, se toma el MAX **en uso**
   * +1 en vez de una secuencia: lo que ya no existe (borrado permanente) deja
   * de contar y la serie se autocorrige. El lock de aplicación serializa dos
   * creaciones simultáneas.
   */
  private async nextNumber(mgr: EntityManager): Promise<number> {
    await mgr.query("SELECT pg_advisory_xact_lock(hashtext('budgets_seq'))");
    const rows = await mgr.query<{ next: string }[]>(
      `SELECT GREATEST(
         (SELECT COALESCE(MAX("number"), 0) + 1
            FROM "budgets" WHERE "deletedAt" IS NULL),
         $1::bigint
       )::text AS next`,
      [String(this.budgetNumberFloor())],
    );
    const next = Number(rows[0]?.next);
    if (!Number.isFinite(next)) {
      throw new BadRequestException(
        'No se pudo asignar el número de presupuesto',
      );
    }
    return next;
  }

  /**
   * Suma de los precios de CATÁLOGO de las filas (baremo del seguro para
   * `insurance`, `particularPriceUsd` para `particular`), más el precio de
   * catálogo por ST para guardarlo como traza en cada línea.
   *
   * `complete` es false si a algún ST le falta precio: ahí el monto base no es
   * comparable y no se exige motivo de ajuste (misma regla que la orden).
   */
  private async catalogPrices(
    type: 'particular' | 'insurance',
    insuranceId: string | null | undefined,
    rows: BudgetServiceTypeRowDto[],
  ): Promise<{ sum: number; complete: boolean; unitByST: Map<string, number> }> {
    const unitByST = new Map<string, number>();
    if (!rows.length) return { sum: 0, complete: false, unitByST };
    const ids = Array.from(new Set(rows.map((r) => r.serviceTypeId)));
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
      cents += Math.round(unit * 100) * Math.max(1, Math.trunc(r.quantity ?? 1));
    }
    return { sum: cents / 100, complete, unitByST };
  }

  /** Suma de las líneas tal como se cotizaron (precio snapshot × cantidad). */
  private quotedSum(rows: BudgetServiceTypeRowDto[]): number {
    let cents = 0;
    for (const r of rows) {
      const qty = Math.max(1, Math.trunc(r.quantity ?? 1));
      cents += Math.round((Number(r.unitPriceUsd) || 0) * 100) * qty;
    }
    return cents / 100;
  }

  /**
   * Valida titular, paciente y la combinación seguro/contratista con las mismas
   * reglas del Paso 1: `insurance` exige seguro y origen; `via_contractor`
   * exige un contratista del titular que tenga ese seguro, y `direct` que el
   * seguro esté asignado al titular.
   */
  private async validateParties(
    dto: CreateBudgetDto | UpdateBudgetDto,
    merged: {
      type: 'particular' | 'insurance';
      holderId: string;
      patientId: string;
      insuranceId?: string | null;
      insuranceSource?: 'direct' | 'via_contractor' | null;
      contractorId?: string | null;
    },
  ): Promise<void> {
    const holder = await this.patientsRepo.findOne({
      where: { id: merged.holderId, deletedAt: IsNull() },
      relations: { contractors: { insurances: true }, insurances: true },
      // Sin eager: el eager de Patient duplica el join de `insurances` y con
      // los `servicePrices` de cada seguro genera un producto cartesiano.
      loadEagerRelations: false,
    });
    if (!holder) {
      throw new BadRequestException('Titular no encontrado o eliminado');
    }
    if (merged.patientId !== merged.holderId) {
      const pat = await this.patientsRepo.findOne({
        where: { id: merged.patientId, deletedAt: IsNull() },
        loadEagerRelations: false,
      });
      if (!pat) {
        throw new BadRequestException('Paciente no encontrado o eliminado');
      }
    }

    if (merged.type === 'insurance') {
      if (!merged.insuranceId) {
        throw new BadRequestException('Tipo seguro: seguro requerido');
      }
      if (!merged.insuranceSource) {
        throw new BadRequestException(
          'Tipo seguro: origen del seguro requerido (direct | via_contractor)',
        );
      }
      if (merged.insuranceSource === 'via_contractor') {
        if (!merged.contractorId) {
          throw new BadRequestException(
            'Origen vía contratista: contratista requerido',
          );
        }
        const contractor = (holder.contractors ?? []).find(
          (c) => c.id === merged.contractorId,
        );
        if (!contractor) {
          throw new BadRequestException('Contratista no asignado al titular');
        }
        if (
          !(contractor.insurances ?? []).some((i) => i.id === merged.insuranceId)
        ) {
          throw new BadRequestException(
            'Seguro no asociado al contratista del titular',
          );
        }
      } else {
        if (merged.contractorId) {
          throw new BadRequestException(
            'Origen directo no admite contratista',
          );
        }
        if (!(holder.insurances ?? []).some((i) => i.id === merged.insuranceId)) {
          throw new BadRequestException(
            'Seguro no asignado directamente al titular',
          );
        }
      }
    } else if (
      merged.insuranceId ||
      merged.insuranceSource ||
      merged.contractorId
    ) {
      throw new BadRequestException(
        'Seguro, origen y contratista sólo aplican a presupuestos de tipo seguro',
      );
    }
  }

  /** Verifica que todos los STs existan y estén vivos. */
  private async validateServiceTypes(
    rows: BudgetServiceTypeRowDto[],
  ): Promise<void> {
    const ids = Array.from(new Set(rows.map((r) => r.serviceTypeId)));
    const found = await this.serviceTypesRepo.find({
      where: { id: In(ids), deletedAt: IsNull() },
      select: ['id'],
      loadEagerRelations: false,
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        'Algún tipo de servicio no existe o fue eliminado',
      );
    }
    for (const r of rows) {
      if (r.providerType === 'doctor' && !r.doctorId) {
        throw new BadRequestException('Fila con proveedor Doctor sin doctor');
      }
      if (r.providerType === 'care_center' && !r.careCenterId) {
        throw new BadRequestException('Fila con proveedor Centro sin centro');
      }
      if (r.providerType === 'doctor' && r.careCenterId) {
        throw new BadRequestException('Fila Doctor no admite Centro');
      }
      if (r.providerType === 'care_center' && r.doctorId) {
        throw new BadRequestException('Fila Centro no admite Doctor');
      }
      if (!r.providerType && (r.doctorId || r.careCenterId)) {
        throw new BadRequestException(
          'Indica el tipo de proveedor de la fila (doctor o centro)',
        );
      }
    }
  }

  /**
   * Monto efectivo + traza del ajuste. El base es la suma de catálogo; si el
   * monto pedido difiere, el motivo es obligatorio. Sin
   * `budgets.edit-amount` el monto se fuerza al base.
   */
  private resolveAmount(args: {
    requested: number;
    base: number;
    complete: boolean;
    note?: string | null;
    canEditAmount: boolean;
  }): { priceAmount: number; priceBaseAmount: string; note: string | null } {
    const { base, complete, canEditAmount } = args;
    const amount = canEditAmount ? args.requested : base;

    // Catálogo incompleto: el base no es comparable, se guarda igual al monto.
    if (!complete) {
      return {
        priceAmount: amount,
        priceBaseAmount: amount.toFixed(2),
        note: null,
      };
    }
    if (Math.round(amount * 100) === Math.round(base * 100)) {
      return { priceAmount: base, priceBaseAmount: base.toFixed(2), note: null };
    }
    const note = canEditAmount ? (args.note ?? '').trim() : '';
    if (!note) {
      throw new BadRequestException(
        'Indica el motivo del ajuste: el monto difiere de la suma de los precios de catálogo',
      );
    }
    return {
      priceAmount: amount,
      priceBaseAmount: base.toFixed(2),
      note,
    };
  }

  /** Reemplaza las líneas del presupuesto por las del DTO, en su orden. */
  private async replaceRows(
    mgr: EntityManager,
    budgetId: string,
    rows: BudgetServiceTypeRowDto[],
    unitByST: Map<string, number>,
  ): Promise<void> {
    await mgr.delete(BudgetServiceType, { budgetId });
    const entities = rows.map((r, i) => {
      const catalog = unitByST.get(r.serviceTypeId);
      return mgr.create(BudgetServiceType, {
        budgetId,
        serviceTypeId: r.serviceTypeId,
        specialtyId: r.specialtyId ?? null,
        customName: r.customName,
        quantity: Math.max(1, Math.trunc(r.quantity ?? 1)),
        unitPriceUsd: (Number(r.unitPriceUsd) || 0).toFixed(2),
        catalogPriceUsd:
          r.catalogPriceUsd != null
            ? Number(r.catalogPriceUsd).toFixed(2)
            : catalog != null
              ? catalog.toFixed(2)
              : null,
        providerType: r.providerType ?? null,
        doctorId: r.providerType === 'doctor' ? (r.doctorId ?? null) : null,
        careCenterId:
          r.providerType === 'care_center' ? (r.careCenterId ?? null) : null,
        position: i,
      });
    });
    await mgr.save(BudgetServiceType, entities);
  }

  private async setPathologies(
    mgr: EntityManager,
    budgetId: string,
    pathologyIds: string[] | undefined,
  ): Promise<void> {
    if (pathologyIds === undefined) return;
    const ids = Array.from(new Set(pathologyIds));
    const pathologies = ids.length
      ? await this.pathologiesRepo.find({ where: { id: In(ids) } })
      : [];
    if (pathologies.length !== ids.length) {
      throw new BadRequestException('Alguna patología no existe');
    }
    const relation = mgr
      .createQueryBuilder()
      .relation(Budget, 'pathologies')
      .of(budgetId);
    // `addAndRemove` quita lo que no esté en la lista nueva: necesita el set
    // actual para calcular la diferencia.
    const current = await relation.loadMany<Pathology>();
    await relation.addAndRemove(
      pathologies.map((p) => p.id),
      current.map((p) => p.id),
    );
  }

  // ------------------------------------------------------------------ CRUD

  async create(dto: CreateBudgetDto, user: AuthenticatedUser): Promise<Budget> {
    await this.assertBranchVisible(dto.branchId, user);
    await this.validateParties(dto, {
      type: dto.type,
      holderId: dto.holderId,
      patientId: dto.patientId,
      insuranceId: dto.insuranceId,
      insuranceSource: dto.insuranceSource,
      contractorId: dto.contractorId,
    });
    await this.validateServiceTypes(dto.serviceTypes);

    const { sum: base, complete, unitByST } = await this.catalogPrices(
      dto.type,
      dto.insuranceId,
      dto.serviceTypes,
    );
    const amount = this.resolveAmount({
      requested: dto.priceAmount,
      base,
      complete,
      note: dto.priceAdjustmentNote,
      canEditAmount: this.userHasPermission(
        user,
        PERMISSIONS.BUDGETS.EDIT_AMOUNT,
      ),
    });

    const id = await this.dataSource.transaction(async (mgr) => {
      const number = await this.nextNumber(mgr);
      const budget = mgr.create(Budget, {
        number: String(number),
        budgetNumber: this.formatBudgetNumber(number),
        branchId: dto.branchId,
        type: dto.type,
        status: 'draft',
        holderId: dto.holderId,
        patientId: dto.patientId,
        insuranceId: dto.type === 'insurance' ? (dto.insuranceId ?? null) : null,
        insuranceSource:
          dto.type === 'insurance' ? (dto.insuranceSource ?? null) : null,
        contractorId:
          dto.type === 'insurance' ? (dto.contractorId ?? null) : null,
        // Especialidad principal: la de la primera fila que la traiga.
        specialtyId:
          dto.serviceTypes.find((r) => r.specialtyId)?.specialtyId ?? null,
        diagnosisNote: dto.diagnosisNote || null,
        observations: dto.observations || null,
        referringDoctorName: dto.referringDoctorName || null,
        referringSpecialtyName: dto.referringSpecialtyName || null,
        budgetDate: dto.budgetDate.slice(0, 10),
        validUntilDate: dto.validUntilDate
          ? dto.validUntilDate.slice(0, 10)
          : null,
        priceAmount: amount.priceAmount.toFixed(2),
        priceBaseAmount: amount.priceBaseAmount,
        priceAdjustmentNote: amount.note,
        exchangeRateId: dto.exchangeRateId ?? null,
        paymentAccountId: dto.paymentAccountId ?? null,
        createdById: user.id,
      });
      const saved = await mgr.save(Budget, budget);
      await this.replaceRows(mgr, saved.id, dto.serviceTypes, unitByST);
      await this.setPathologies(mgr, saved.id, dto.pathologyIds ?? []);
      return saved.id;
    });

    return this.findOne(id, user);
  }

  async findAll(
    query: QueryBudgetsDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Budget>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      branchId,
      insuranceId,
      patientId,
      budgetDateFrom,
      budgetDateTo,
      expired,
      converted,
      sortBy = 'budgetNumber',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
    } = query;

    const qb: SelectQueryBuilder<Budget> = this.repo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.branch', 'branch')
      .leftJoinAndSelect('b.holder', 'holder')
      .leftJoinAndSelect('holder.phones', 'holderPhones')
      .leftJoinAndSelect('b.patient', 'patient')
      .leftJoinAndSelect('patient.phones', 'patientPhones')
      .leftJoinAndSelect('b.insurance', 'insurance')
      .leftJoinAndSelect('b.contractor', 'contractor')
      .leftJoinAndSelect('b.specialty', 'specialty')
      .leftJoinAndSelect('b.budgetServiceTypes', 'bst')
      .leftJoinAndSelect('bst.serviceType', 'serviceType')
      .leftJoinAndSelect('b.convertedOrder', 'convertedOrder')
      .leftJoinAndSelect('b.createdBy', 'createdBy');

    // `budgetNumber` es varchar: se ordena por su valor numérico (`number`).
    qb.orderBy(sortBy === 'budgetNumber' ? 'b.number' : `b.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('b.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('b.branchId IN (:...allowed)', { allowed });
    }

    if (branchId) qb.andWhere('b.branchId = :branchId', { branchId });
    if (status) qb.andWhere('b.status = :status', { status });
    if (type) qb.andWhere('b.type = :type', { type });
    if (insuranceId) qb.andWhere('b.insuranceId = :insuranceId', { insuranceId });
    if (patientId) qb.andWhere('b.patientId = :patientId', { patientId });
    if (budgetDateFrom)
      qb.andWhere('b.budgetDate >= :bdf', { bdf: budgetDateFrom });
    if (budgetDateTo) qb.andWhere('b.budgetDate <= :bdt', { bdt: budgetDateTo });

    // Vencido = con fecha de vigencia pasada y todavía sin decidir. Se filtra en
    // SQL (no sobre el transient) para que la paginación cuente bien.
    if (expired === 'true') {
      qb.andWhere(
        `(b."validUntilDate" IS NOT NULL AND b."validUntilDate" < :today
          AND b.status IN ('draft','sent'))`,
        { today: todayIso() },
      );
    } else if (expired === 'false') {
      qb.andWhere(
        `(b."validUntilDate" IS NULL OR b."validUntilDate" >= :today
          OR b.status NOT IN ('draft','sent'))`,
        { today: todayIso() },
      );
    }
    if (converted === 'true') qb.andWhere('b."convertedOrderId" IS NOT NULL');
    else if (converted === 'false') qb.andWhere('b."convertedOrderId" IS NULL');

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(b."budgetNumber") LIKE :s
          OR LOWER(holder."firstName") LIKE :s
          OR LOWER(holder."lastName") LIKE :s
          OR LOWER(holder."businessName") LIKE :s
          OR LOWER(holder.cedula) LIKE :s
          OR LOWER(holder.rif) LIKE :s
          OR LOWER(patient."firstName") LIKE :s
          OR LOWER(patient."lastName") LIKE :s
          OR LOWER(patient."businessName") LIKE :s
          OR LOWER(patient.cedula) LIKE :s
          OR LOWER(patient.rif) LIKE :s
          OR LOWER(insurance.name) LIKE :s)`,
        { s },
      );
    }

    const result = await paginateBuilder<Budget>(qb, page, limit);
    result.data.forEach((b) => this.decorate(b));
    return result;
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    withDeleted = false,
  ): Promise<Budget> {
    const budget = await this.repo.findOne({
      where: { id },
      relations: this.budgetRelations(),
      // Sin eager: evita el producto cartesiano de los seguros del paciente.
      loadEagerRelations: false,
      withDeleted,
    });
    if (!budget) throw new NotFoundException('Presupuesto no encontrado');
    await this.assertBranchVisible(budget.branchId, user);
    return this.decorate(budget);
  }

  async update(
    id: string,
    dto: UpdateBudgetDto,
    user: AuthenticatedUser,
  ): Promise<Budget> {
    const existing = await this.findOne(id, user);
    if (existing.convertedOrderId) {
      throw new ConflictException(
        `El presupuesto ya generó la orden N° ${existing.convertedOrder?.orderNumber ?? ''} y no se puede editar`.trim(),
      );
    }
    if (dto.branchId) await this.assertBranchVisible(dto.branchId, user);

    const merged = {
      type: dto.type ?? existing.type,
      holderId: dto.holderId ?? existing.holderId,
      patientId: dto.patientId ?? existing.patientId,
      insuranceId:
        dto.insuranceId !== undefined ? dto.insuranceId : existing.insuranceId,
      insuranceSource:
        dto.insuranceSource !== undefined
          ? dto.insuranceSource
          : existing.insuranceSource,
      contractorId:
        dto.contractorId !== undefined
          ? dto.contractorId
          : existing.contractorId,
    };
    // Cambio a `particular`: los campos de seguro se limpian, no se arrastran.
    if (merged.type === 'particular') {
      merged.insuranceId = null;
      merged.insuranceSource = null;
      merged.contractorId = null;
    }
    await this.validateParties(dto, merged);

    const rows: BudgetServiceTypeRowDto[] =
      dto.serviceTypes ??
      existing.budgetServiceTypes.map((r) => ({
        serviceTypeId: r.serviceTypeId,
        specialtyId: r.specialtyId ?? undefined,
        customName: r.customName,
        quantity: r.quantity,
        unitPriceUsd: Number(r.unitPriceUsd),
        catalogPriceUsd:
          r.catalogPriceUsd != null ? Number(r.catalogPriceUsd) : undefined,
        providerType: r.providerType ?? undefined,
        doctorId: r.doctorId ?? undefined,
        careCenterId: r.careCenterId ?? undefined,
      }));
    if (!rows.length) {
      throw new BadRequestException('Agrega al menos un servicio');
    }
    await this.validateServiceTypes(rows);

    const { sum: base, complete, unitByST } = await this.catalogPrices(
      merged.type,
      merged.insuranceId,
      rows,
    );
    const amount = this.resolveAmount({
      requested: dto.priceAmount ?? Number(existing.priceAmount),
      base,
      complete,
      note: dto.priceAdjustmentNote ?? existing.priceAdjustmentNote,
      canEditAmount: this.userHasPermission(
        user,
        PERMISSIONS.BUDGETS.EDIT_AMOUNT,
      ),
    });

    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(Budget, id, {
        branchId: dto.branchId ?? existing.branchId,
        type: merged.type,
        holderId: merged.holderId,
        patientId: merged.patientId,
        insuranceId: merged.insuranceId ?? null,
        insuranceSource: merged.insuranceSource ?? null,
        contractorId: merged.contractorId ?? null,
        specialtyId: rows.find((r) => r.specialtyId)?.specialtyId ?? null,
        diagnosisNote:
          dto.diagnosisNote !== undefined
            ? dto.diagnosisNote || null
            : existing.diagnosisNote,
        observations:
          dto.observations !== undefined
            ? dto.observations || null
            : existing.observations,
        referringDoctorName:
          dto.referringDoctorName !== undefined
            ? dto.referringDoctorName || null
            : existing.referringDoctorName,
        referringSpecialtyName:
          dto.referringSpecialtyName !== undefined
            ? dto.referringSpecialtyName || null
            : existing.referringSpecialtyName,
        budgetDate: (dto.budgetDate ?? existing.budgetDate).slice(0, 10),
        validUntilDate:
          dto.validUntilDate !== undefined
            ? dto.validUntilDate
              ? dto.validUntilDate.slice(0, 10)
              : null
            : existing.validUntilDate,
        priceAmount: amount.priceAmount.toFixed(2),
        priceBaseAmount: amount.priceBaseAmount,
        priceAdjustmentNote: amount.note,
        exchangeRateId:
          dto.exchangeRateId !== undefined
            ? (dto.exchangeRateId ?? null)
            : existing.exchangeRateId,
        paymentAccountId:
          dto.paymentAccountId !== undefined
            ? (dto.paymentAccountId ?? null)
            : existing.paymentAccountId,
      });
      if (dto.serviceTypes) {
        await this.replaceRows(mgr, id, rows, unitByST);
      }
      await this.setPathologies(mgr, id, dto.pathologyIds);
    });

    return this.findOne(id, user);
  }

  /**
   * Cambio de estado. Transiciones permitidas:
   *   draft → sent | approved | rejected
   *   sent  → approved | rejected | draft (corrección antes de decidir)
   *   approved / rejected → sent | draft (reabrir)
   * `rejected` exige motivo. Un presupuesto ya convertido en orden queda fijo
   * en `approved`: su decisión ya se materializó.
   */
  async changeStatus(
    id: string,
    dto: ChangeBudgetStatusDto,
    user: AuthenticatedUser,
  ): Promise<Budget> {
    const budget = await this.findOne(id, user);
    if (budget.convertedOrderId && dto.status !== 'approved') {
      throw new ConflictException(
        'El presupuesto ya generó una orden: su estado no se puede cambiar',
      );
    }
    if (dto.status === budget.status) return budget;
    if (dto.status === 'rejected' && !(dto.rejectReason ?? '').trim()) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }

    const now = new Date();
    await this.repo.update(id, {
      status: dto.status,
      // `sentAt` se estampa la primera vez que sale; reabrir no lo borra.
      sentAt:
        dto.status === 'sent' && !budget.sentAt ? now : (budget.sentAt ?? null),
      decidedAt:
        dto.status === 'approved' || dto.status === 'rejected' ? now : null,
      rejectReason:
        dto.status === 'rejected' ? (dto.rejectReason ?? '').trim() : null,
    });
    return this.findOne(id, user);
  }

  /**
   * Enlaza la orden que nació del presupuesto. La orden la crea el módulo de
   * órdenes (Paso 1 precargado); aquí sólo se guarda el vínculo y se da el
   * presupuesto por aprobado.
   */
  async linkOrder(
    id: string,
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<Budget> {
    const budget = await this.findOne(id, user);
    if (budget.convertedOrderId) {
      throw new ConflictException(
        `El presupuesto ya está enlazado a la orden N° ${budget.convertedOrder?.orderNumber ?? ''}`.trim(),
      );
    }
    const exists = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM "orders" WHERE id = $1 AND "deletedAt" IS NULL`,
      [orderId],
    );
    if (!exists.length) throw new BadRequestException('Orden no encontrada');

    await this.repo.update(id, {
      convertedOrderId: orderId,
      convertedAt: new Date(),
      status: 'approved',
      decidedAt: budget.decidedAt ?? new Date(),
      rejectReason: null,
    });
    return this.findOne(id, user);
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.repo.softDelete(id);
  }

  async restore(id: string, user: AuthenticatedUser): Promise<Budget> {
    const budget = await this.findOne(id, user, true);
    if (!budget.deletedAt) return budget;
    // El número pudo quedar ocupado mientras el presupuesto estaba en papelera.
    const taken = await this.repo
      .createQueryBuilder('b')
      .where('b.number = :n', { n: budget.number })
      .andWhere('b.id <> :id', { id })
      .andWhere('b.deletedAt IS NULL')
      .getCount();
    if (taken > 0) {
      throw new ConflictException(
        `El número ${budget.budgetNumber} ya está en uso: no se puede restaurar`,
      );
    }
    await this.repo.restore(id);
    return this.findOne(id, user);
  }

  async hardDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user, true);
    // `budget_service_types` y `budget_pathologies` caen por FK ON DELETE CASCADE.
    await this.repo.delete(id);
  }
}

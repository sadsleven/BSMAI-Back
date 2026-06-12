import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';

export type SearchResultGroup =
  | 'patients'
  | 'orders'
  | 'doctors'
  | 'care-centers';

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel?: string | null;
  badge?: string | null;
}

export interface SearchResults {
  patients: SearchResultItem[];
  orders: SearchResultItem[];
  doctors: SearchResultItem[];
  careCenters: SearchResultItem[];
}

const RESULT_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    @InjectRepository(CareCenter)
    private readonly careCentersRepo: Repository<CareCenter>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    private readonly dataSource: DataSource,
  ) {}

  async search(query: string, user: AuthenticatedUser): Promise<SearchResults> {
    const q = (query ?? '').trim();
    const empty: SearchResults = {
      patients: [],
      orders: [],
      doctors: [],
      careCenters: [],
    };
    if (q.length < 2) return empty;

    const hasPerm = (p: string) => user.isSuperAdmin || user.permissions.includes(p);

    const tasks: Array<Promise<void>> = [];
    if (hasPerm(PERMISSIONS.PATIENTS.LIST))
      tasks.push(this.searchPatients(q).then((r) => void (empty.patients = r)));
    if (hasPerm(PERMISSIONS.DOCTORS.LIST))
      tasks.push(this.searchDoctors(q).then((r) => void (empty.doctors = r)));
    if (hasPerm(PERMISSIONS.CARE_CENTERS.LIST))
      tasks.push(this.searchCareCenters(q).then((r) => void (empty.careCenters = r)));
    if (hasPerm(PERMISSIONS.ORDERS.LIST))
      tasks.push(this.searchOrders(q, user).then((r) => void (empty.orders = r)));

    await Promise.all(tasks);
    return empty;
  }

  private async searchPatients(q: string): Promise<SearchResultItem[]> {
    const like = `%${q.toLowerCase()}%`;
    const rows = await this.patientsRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(COALESCE(p.firstName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(p.lastName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(p.businessName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(p.cedula, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(p.rif, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(p.email, \'\')) LIKE :like', { like });
        }),
      )
      .orderBy('p.updatedAt', 'DESC')
      .take(RESULT_LIMIT)
      .getMany();

    return rows.map((p) => {
      const isNatural = p.personType === 'natural';
      const label = isNatural
        ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email || 'Paciente'
        : p.businessName || 'Paciente jurídico';
      const sublabel = isNatural
        ? p.cedula ?? p.email ?? null
        : p.rif ?? p.email ?? null;
      return {
        id: p.id,
        label,
        sublabel,
        badge: isNatural ? 'Natural' : 'Jurídico',
      };
    });
  }

  private async searchDoctors(q: string): Promise<SearchResultItem[]> {
    const like = `%${q.toLowerCase()}%`;
    const rows = await this.doctorsRepo
      .createQueryBuilder('d')
      .where('d.deletedAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(d.firstName) LIKE :like', { like })
            .orWhere('LOWER(d.lastName) LIKE :like', { like })
            .orWhere('LOWER(d.cedula) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(d.rif, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(d.email, \'\')) LIKE :like', { like });
        }),
      )
      .orderBy('d.updatedAt', 'DESC')
      .take(RESULT_LIMIT)
      .getMany();

    return rows.map((d) => ({
      id: d.id,
      label: `${d.firstName} ${d.lastName}`.trim(),
      sublabel: d.cedula,
      badge: d.isLegalEntity ? 'Jurídico' : null,
    }));
  }

  private async searchCareCenters(q: string): Promise<SearchResultItem[]> {
    const like = `%${q.toLowerCase()}%`;
    const rows = await this.careCentersRepo
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(c.businessName) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(c.rif, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(c.email, \'\')) LIKE :like', { like });
        }),
      )
      .orderBy('c.updatedAt', 'DESC')
      .take(RESULT_LIMIT)
      .getMany();

    return rows.map((c) => ({
      id: c.id,
      label: c.businessName,
      sublabel: c.rif ?? c.email ?? null,
      badge: null,
    }));
  }

  private async searchOrders(
    q: string,
    user: AuthenticatedUser,
  ): Promise<SearchResultItem[]> {
    const like = `%${q.toLowerCase()}%`;
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoin('o.holder', 'holder')
      .leftJoin('o.patient', 'patient')
      .where('o.deletedAt IS NULL')
      .andWhere(
        new Brackets((b) => {
          b.where('LOWER(o.orderNumber) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(holder.firstName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(holder.lastName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(holder.businessName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(holder.cedula, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(holder.rif, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(patient.firstName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(patient.lastName, \'\')) LIKE :like', { like })
            .orWhere('LOWER(COALESCE(patient.cedula, \'\')) LIKE :like', { like });
        }),
      )
      .addSelect([
        'holder.id',
        'holder.firstName',
        'holder.lastName',
        'holder.businessName',
        'patient.id',
        'patient.firstName',
        'patient.lastName',
      ]);

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (!allowed.length) return [];
      qb.andWhere('o.branchId IN (:...allowed)', { allowed });
    }

    const rows = await qb
      .orderBy('o.createdAt', 'DESC')
      .take(RESULT_LIMIT)
      .getMany();

    return rows.map((o) => {
      const h = o.holder;
      const holderName = h
        ? h.personType === 'legal_entity'
          ? h.businessName ?? ''
          : `${h.firstName ?? ''} ${h.lastName ?? ''}`.trim()
        : '';
      return {
        id: o.id,
        label: `#${o.orderNumber}`,
        sublabel: holderName || null,
        badge: this.orderStatusBadge(o.status),
      };
    });
  }

  private orderStatusBadge(status: string): string {
    const map: Record<string, string> = {
      draft: 'Borrador',
      in_progress: 'En curso',
      attended: 'Atendida',
      report_issued: 'Con informe',
      finalized: 'Finalizada',
      cancelled: 'Cancelada',
    };
    return map[status] ?? status;
  }

  private async resolveUserBranchIds(user: AuthenticatedUser): Promise<string[]> {
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
}

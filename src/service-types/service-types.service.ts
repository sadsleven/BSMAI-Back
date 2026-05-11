import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ServiceType } from './entities/service-type.entity';
import { ServiceTypePrice } from './entities/service-type-price.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { QueryServiceTypesDto } from './dto/query-service-types.dto';
import { ServiceTypePriceDto } from './dto/service-type-price.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class ServiceTypesService {
  constructor(
    @InjectRepository(ServiceType) private readonly repo: Repository<ServiceType>,
    @InjectRepository(ServiceTypePrice)
    private readonly pricesRepo: Repository<ServiceTypePrice>,
    @InjectRepository(Insurance) private readonly insurancesRepo: Repository<Insurance>,
  ) {}

  async findAll(query: QueryServiceTypesDto): Promise<PaginatedResponse<ServiceType>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
    } = query;

    const qb = this.repo.createQueryBuilder('st').orderBy(`st.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('st.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere('(LOWER(st.name) LIKE :s OR LOWER(st.description) LIKE :s)', {
        s: `%${search.trim().toLowerCase()}%`,
      });
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('st.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<ServiceType>(qb, page, limit);
  }

  async findAssignable(): Promise<ServiceType[]> {
    return this.repo.find({
      where: { isActive: true },
      relations: { prices: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<ServiceType> {
    const st = await this.repo.findOne({
      where: { id },
      relations: { prices: { insurance: true } },
      withDeleted,
    });
    if (!st) throw new NotFoundException('Tipo de servicio no encontrado');
    return st;
  }

  async create(dto: CreateServiceTypeDto): Promise<ServiceType> {
    const exists = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe un tipo de servicio con ese nombre');

    await this.validatePriceInsurances(dto.prices ?? []);

    const st = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(st);

    const prices = this.normalizePrices(dto.prices ?? []);
    if (prices.length) {
      await this.pricesRepo.insert(
        prices.map((p) => ({ ...p, serviceTypeId: saved.id })),
      );
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateServiceTypeDto): Promise<ServiceType> {
    const st = await this.findOne(id);
    if (dto.name && dto.name !== st.name) {
      const dupe = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
      if (dupe) throw new ConflictException('Ya existe un tipo de servicio con ese nombre');
      st.name = dto.name;
    }
    if (dto.description !== undefined) st.description = dto.description ?? null;
    if (dto.isActive !== undefined) st.isActive = dto.isActive;
    await this.repo.save(st);

    if (dto.prices !== undefined) {
      await this.validatePriceInsurances(dto.prices);
      // Replace-all: borrar y re-insertar.
      await this.pricesRepo.delete({ serviceTypeId: st.id });
      const prices = this.normalizePrices(dto.prices);
      if (prices.length) {
        await this.pricesRepo.insert(
          prices.map((p) => ({ ...p, serviceTypeId: st.id })),
        );
      }
    }

    return this.findOne(st.id);
  }

  async toggleActive(id: string): Promise<ServiceType> {
    const st = await this.findOne(id);
    st.isActive = !st.isActive;
    return this.repo.save(st);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<ServiceType> {
    const st = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!st) throw new NotFoundException('Tipo de servicio no encontrado');
    if (!st.deletedAt) return this.findOne(id);
    await this.repo.restore(id);
    return this.findOne(id);
  }

  // ---- helpers ----

  /** Verifica que insuranceIds existan y no estén borrados. Permite duplicados detectados aparte. */
  private async validatePriceInsurances(prices: ServiceTypePriceDto[]): Promise<void> {
    const ids = Array.from(
      new Set(prices.map((p) => p.insuranceId).filter((v): v is string => !!v)),
    );
    if (!ids.length) return;
    const found = await this.insurancesRepo.find({
      where: { id: In(ids), deletedAt: IsNull() },
      select: ['id'],
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Algún seguro de la lista de precios no existe');
    }
  }

  /**
   * Normaliza prices: filtra filas vacías (sin USD ni EUR), valida unicidad por
   * (insuranceId | particular), serializa números a string numeric.
   */
  private normalizePrices(
    prices: ServiceTypePriceDto[],
  ): Array<Partial<ServiceTypePrice>> {
    const seen = new Set<string>();
    const out: Array<Partial<ServiceTypePrice>> = [];
    for (const p of prices) {
      const usd = p.priceUsd === undefined || p.priceUsd === null ? null : p.priceUsd;
      const eur = p.priceEur === undefined || p.priceEur === null ? null : p.priceEur;
      if (usd === null && eur === null) continue;
      const key = p.insuranceId ?? '__particular__';
      if (seen.has(key)) {
        throw new BadRequestException(
          'Hay precios duplicados: cada seguro (y Particular) admite una sola entrada',
        );
      }
      seen.add(key);
      out.push({
        insuranceId: p.insuranceId ?? null,
        priceUsd: usd === null ? null : usd.toFixed(2),
        priceEur: eur === null ? null : eur.toFixed(2),
      });
    }
    return out;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Currency, ExchangeRate } from './entities/exchange-rate.entity';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { QueryExchangeRatesDto } from './dto/query-exchange-rates.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRate) private readonly repo: Repository<ExchangeRate>,
  ) {}

  async findAll(query: QueryExchangeRatesDto): Promise<PaginatedResponse<ExchangeRate>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'effectiveDate',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      currency,
      effectiveDateFrom,
      effectiveDateTo,
    } = query;

    const qb = this.repo.createQueryBuilder('rate').orderBy(`rate.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('rate.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (currency) {
      qb.andWhere('rate.currency = :c', { c: currency });
    }
    if (effectiveDateFrom) {
      qb.andWhere('rate.effectiveDate >= :df', { df: effectiveDateFrom });
    }
    if (effectiveDateTo) {
      qb.andWhere('rate.effectiveDate <= :dt', { dt: effectiveDateTo });
    }
    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('rate.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<ExchangeRate>(qb, page, limit);
  }

  async findCurrent(currency: Currency): Promise<ExchangeRate> {
    const rate = await this.repo.findOne({
      where: { currency, isActive: true, deletedAt: IsNull() },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
    if (!rate) {
      throw new NotFoundException(`No hay tasa de cambio activa para ${currency}`);
    }
    return rate;
  }

  /**
   * Latest active + non-deleted rate per currency, in one call. Either side
   * may be `null` if there is no active rate yet for that currency. Used by
   * the FE navbar to show both USD and EUR side-by-side.
   */
  async findCurrentSummary(): Promise<Record<Currency, ExchangeRate | null>> {
    const findOne = (currency: Currency) =>
      this.repo.findOne({
        where: { currency, isActive: true, deletedAt: IsNull() },
        order: { effectiveDate: 'DESC', createdAt: 'DESC' },
      });
    const [usd, eur] = await Promise.all([findOne('USD'), findOne('EUR')]);
    return { USD: usd, EUR: eur };
  }

  async findOne(id: string, withDeleted = false): Promise<ExchangeRate> {
    const rate = await this.repo.findOne({ where: { id }, withDeleted });
    if (!rate) throw new NotFoundException('Tasa de cambio no encontrada');
    return rate;
  }

  async create(dto: CreateExchangeRateDto): Promise<ExchangeRate> {
    const rate = this.repo.create({
      currency: dto.currency,
      amountBs: dto.amountBs.toFixed(2),
      effectiveDate: dto.effectiveDate,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(rate);
  }

  async update(id: string, dto: UpdateExchangeRateDto): Promise<ExchangeRate> {
    const rate = await this.findOne(id);
    if (dto.currency !== undefined) rate.currency = dto.currency;
    if (dto.amountBs !== undefined) rate.amountBs = dto.amountBs.toFixed(2);
    if (dto.effectiveDate !== undefined) rate.effectiveDate = dto.effectiveDate;
    if (dto.isActive !== undefined) rate.isActive = dto.isActive;
    return this.repo.save(rate);
  }

  async toggleActive(id: string): Promise<ExchangeRate> {
    const rate = await this.findOne(id);
    rate.isActive = !rate.isActive;
    return this.repo.save(rate);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<ExchangeRate> {
    const rate = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!rate) throw new NotFoundException('Tasa de cambio no encontrada');
    if (!rate.deletedAt) return rate;
    await this.repo.restore(id);
    return this.findOne(id);
  }
}

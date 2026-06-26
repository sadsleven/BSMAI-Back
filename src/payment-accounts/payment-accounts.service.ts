import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaymentAccount, PaymentAccountType } from './entities/payment-account.entity';
import { Bank } from '../banks/entities/bank.entity';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import {
  QueryPaymentAccountsDto,
  AssignablePaymentAccountsQueryDto,
} from './dto/query-payment-accounts.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class PaymentAccountsService {
  constructor(
    @InjectRepository(PaymentAccount)
    private readonly repo: Repository<PaymentAccount>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
  ) {}

  async findAll(query: QueryPaymentAccountsDto): Promise<PaginatedResponse<PaymentAccount>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      type,
    } = query;

    const qb = this.repo
      .createQueryBuilder('pa')
      .orderBy(`pa.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('pa.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(pa.name) LIKE :s OR LOWER(pa.idDocument) LIKE :s OR LOWER(pa.accountNumber) LIKE :s OR LOWER(pa.phoneNumber) LIKE :s OR LOWER(pa.accountHolderName) LIKE :s)',
        { s },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('pa.isActive = :a', { a: isActive === 'true' });
    }

    if (type) {
      qb.andWhere('pa.type = :t', { t: type });
    }

    return paginateBuilder<PaymentAccount>(qb, page, limit);
  }

  async findAssignable(
    query: AssignablePaymentAccountsQueryDto = {},
  ): Promise<PaymentAccount[]> {
    return this.repo.find({
      where: {
        isActive: true,
        deletedAt: IsNull(),
        ...(query.type ? { type: query.type } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<PaymentAccount> {
    const acc = await this.repo.findOne({ where: { id }, withDeleted });
    if (!acc) throw new NotFoundException('Cuenta bancaria no encontrada');
    return acc;
  }

  async create(dto: CreatePaymentAccountDto): Promise<PaymentAccount> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');

    const exists = await this.repo.findOne({ where: { name }, withDeleted: false });
    if (exists) throw new ConflictException('Ya existe una cuenta bancaria con ese nombre');

    await this.assertBankExists(dto.type, dto.bankCode);

    const acc = this.repo.create(this.buildPayloadFromDto(dto, name));
    return this.repo.save(acc);
  }

  async update(id: string, dto: UpdatePaymentAccountDto): Promise<PaymentAccount> {
    const acc = await this.findOne(id);

    if (dto.type && dto.type !== acc.type) {
      throw new BadRequestException(
        'No se puede cambiar el tipo de una cuenta bancaria. Crea una nueva y deshabilita la anterior.',
      );
    }

    if (dto.name && dto.name.trim() !== acc.name) {
      const name = dto.name.trim();
      const dupe = await this.repo.findOne({ where: { name } });
      if (dupe && dupe.id !== id) {
        throw new ConflictException('Ya existe una cuenta bancaria con ese nombre');
      }
      acc.name = name;
    }

    await this.assertBankExists(acc.type, dto.bankCode);

    const t = acc.type;
    const patch = this.buildPayloadFromDto(
      { ...dto, type: t } as CreatePaymentAccountDto,
      acc.name,
      true,
    );

    // Para PATCH, solo sobreescribir campos presentes en dto.
    if (dto.isActive !== undefined) acc.isActive = patch.isActive!;
    if (t === 'mobile_payment') {
      if (dto.bankCode !== undefined) acc.bankCode = patch.bankCode ?? null;
      if (dto.phoneNumber !== undefined) acc.phoneNumber = patch.phoneNumber ?? null;
      if (dto.idDocument !== undefined) acc.idDocument = patch.idDocument ?? null;
      if (dto.accountHolderName !== undefined)
        acc.accountHolderName = patch.accountHolderName ?? null;
    } else if (t === 'bank_transfer' || t === 'bank_transfer_usd') {
      if (dto.bankCode !== undefined) acc.bankCode = patch.bankCode ?? null;
      if (dto.accountNumber !== undefined) acc.accountNumber = patch.accountNumber ?? null;
      if (dto.accountHolderName !== undefined)
        acc.accountHolderName = patch.accountHolderName ?? null;
      if (dto.idDocument !== undefined) acc.idDocument = patch.idDocument ?? null;
    } else if (t === 'card') {
      if (dto.bankCode !== undefined) acc.bankCode = patch.bankCode ?? null;
      if (dto.accountHolderName !== undefined)
        acc.accountHolderName = patch.accountHolderName ?? null;
    } else {
      if (dto.description !== undefined) acc.description = patch.description ?? null;
    }

    return this.repo.save(acc);
  }

  async toggleActive(id: string): Promise<PaymentAccount> {
    const acc = await this.findOne(id);
    acc.isActive = !acc.isActive;
    return this.repo.save(acc);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<PaymentAccount> {
    const acc = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!acc) throw new NotFoundException('Cuenta bancaria no encontrada');
    if (!acc.deletedAt) return acc;
    await this.repo.restore(id);
    return this.findOne(id);
  }

  /**
   * Validación cross-module — usada por Orders y AR services cuando un pago
   * de tipo {mobile_payment, bank_transfer, other} referencia una cuenta.
   * Carga la cuenta (excluye borradas) y rechaza si no aplica.
   */
  async assertUsableForPaymentType(
    paymentAccountId: string,
    paymentType: PaymentAccountType,
  ): Promise<PaymentAccount> {
    const acc = await this.repo.findOne({ where: { id: paymentAccountId } });
    if (!acc) {
      throw new BadRequestException(
        `Cuenta bancaria ${paymentAccountId} no encontrada`,
      );
    }
    if (acc.deletedAt) {
      throw new BadRequestException(
        `La cuenta bancaria "${acc.name}" está en papelera y no puede usarse`,
      );
    }
    if (!acc.isActive) {
      throw new BadRequestException(
        `La cuenta bancaria "${acc.name}" está deshabilitada`,
      );
    }
    if (acc.type !== paymentType) {
      throw new BadRequestException(
        `El tipo de la cuenta "${acc.name}" (${acc.type}) no coincide con el tipo del pago (${paymentType})`,
      );
    }
    return acc;
  }

  private async assertBankExists(
    type: PaymentAccountType,
    bankCode: string | undefined,
  ): Promise<void> {
    if (
      type !== 'mobile_payment' &&
      type !== 'bank_transfer' &&
      type !== 'bank_transfer_usd' &&
      type !== 'card'
    )
      return;
    if (!bankCode) return;
    const bank = await this.banksRepo.findOne({ where: { code: bankCode } });
    if (!bank) {
      throw new BadRequestException(`Banco con código "${bankCode}" no existe`);
    }
  }

  /** Construye el shape persistible, limpiando campos que no aplican al type. */
  private buildPayloadFromDto(
    dto: CreatePaymentAccountDto,
    name: string,
    partial = false,
  ): Partial<PaymentAccount> {
    const base: Partial<PaymentAccount> = {
      name,
      type: dto.type,
      isActive: dto.isActive ?? true,
      bankCode: null,
      phoneNumber: null,
      idDocument: null,
      accountHolderName: null,
      accountNumber: null,
      description: null,
    };

    if (dto.type === 'mobile_payment') {
      base.bankCode = dto.bankCode ?? null;
      base.phoneNumber = dto.phoneNumber ?? null;
      base.idDocument = dto.idDocument ?? null;
      base.accountHolderName = dto.accountHolderName ?? null;
    } else if (
      dto.type === 'bank_transfer' ||
      dto.type === 'bank_transfer_usd'
    ) {
      base.bankCode = dto.bankCode ?? null;
      base.accountNumber = dto.accountNumber ?? null;
      base.accountHolderName = dto.accountHolderName ?? null;
      base.idDocument = dto.idDocument ?? null;
    } else if (dto.type === 'card') {
      // Punto (POS de tarjeta): banco emisor + titular.
      base.bankCode = dto.bankCode ?? null;
      base.accountHolderName = dto.accountHolderName ?? null;
    } else {
      base.description = dto.description ?? null;
    }

    if (partial) delete base.isActive;
    return base;
  }
}

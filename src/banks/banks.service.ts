import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(Bank) private readonly repo: Repository<Bank>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Bank[]> {
    return this.repo.find({ order: { code: 'ASC' } });
  }

  findByCode(code: string): Promise<Bank | null> {
    return this.repo.findOne({ where: { code } });
  }

  async findOne(id: string): Promise<Bank> {
    const bank = await this.repo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Banco no encontrado');
    return bank;
  }

  async create(dto: CreateBankDto): Promise<Bank> {
    const dupe = await this.repo.findOne({ where: { code: dto.code } });
    if (dupe) {
      throw new ConflictException(
        `Ya existe un banco con el código ${dto.code}`,
      );
    }
    const bank = this.repo.create({
      code: dto.code,
      name: dto.name,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(bank);
  }

  /**
   * Al cambiar el código, propaga el nuevo código a las referencias vivas
   * (métodos de pago de doctores/centros y cuentas bancarias propias), que
   * referencian al banco por valor. Los snapshots históricos de pagos
   * (`order_payments`, pagos de lotes) NO se tocan.
   */
  async update(id: string, dto: UpdateBankDto): Promise<Bank> {
    const bank = await this.findOne(id);
    const oldCode = bank.code;

    if (dto.code !== undefined && dto.code !== oldCode) {
      const dupe = await this.repo.findOne({ where: { code: dto.code } });
      if (dupe) {
        throw new ConflictException(
          `Ya existe un banco con el código ${dto.code}`,
        );
      }
      bank.code = dto.code;
    }
    if (dto.name !== undefined) bank.name = dto.name;
    if (dto.isActive !== undefined) bank.isActive = dto.isActive;

    if (bank.code === oldCode) {
      return this.repo.save(bank);
    }

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(bank);
      for (const table of [
        'doctor_payment_methods',
        'care_center_payment_methods',
        'payment_accounts',
      ]) {
        await manager.query(
          `UPDATE "${table}" SET "bankCode" = $1 WHERE "bankCode" = $2`,
          [saved.code, oldCode],
        );
      }
      return saved;
    });
  }

  async toggleActive(id: string): Promise<Bank> {
    const bank = await this.findOne(id);
    bank.isActive = !bank.isActive;
    return this.repo.save(bank);
  }
}

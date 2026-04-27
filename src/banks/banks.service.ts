import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';

@Injectable()
export class BanksService {
  constructor(@InjectRepository(Bank) private readonly repo: Repository<Bank>) {}

  findAll(): Promise<Bank[]> {
    return this.repo.find({ order: { code: 'ASC' } });
  }

  findByCode(code: string): Promise<Bank | null> {
    return this.repo.findOne({ where: { code } });
  }
}

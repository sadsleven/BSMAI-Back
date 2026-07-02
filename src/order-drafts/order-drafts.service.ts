import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderDraft } from './entities/order-draft.entity';
import { SaveOrderDraftDto } from './dto/save-order-draft.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * CRUD de borradores parciales del Paso 1. Todo scoped por `userId`: cada
 * usuario sólo ve y muta sus propios borradores (incluido Super Admin — son
 * espacio de trabajo personal, no recurso compartido).
 */
@Injectable()
export class OrderDraftsService {
  constructor(
    @InjectRepository(OrderDraft)
    private readonly repo: Repository<OrderDraft>,
  ) {}

  list(user: AuthenticatedUser): Promise<OrderDraft[]> {
    return this.repo.find({
      where: { userId: user.id },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<OrderDraft> {
    const draft = await this.repo.findOne({ where: { id, userId: user.id } });
    if (!draft) throw new NotFoundException('Borrador no encontrado');
    return draft;
  }

  create(dto: SaveOrderDraftDto, user: AuthenticatedUser): Promise<OrderDraft> {
    const draft = this.repo.create({
      userId: user.id,
      branchId: dto.branchId ?? null,
      label: dto.label ?? null,
      payload: dto.payload,
    });
    return this.repo.save(draft);
  }

  async update(
    id: string,
    dto: SaveOrderDraftDto,
    user: AuthenticatedUser,
  ): Promise<OrderDraft> {
    const draft = await this.findOne(id, user);
    draft.branchId = dto.branchId ?? null;
    draft.label = dto.label ?? null;
    draft.payload = dto.payload;
    return this.repo.save(draft);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const draft = await this.findOne(id, user);
    await this.repo.remove(draft);
  }
}

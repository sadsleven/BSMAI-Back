import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FileEntity, FileOwnerType } from './entities/file.entity';
import { UploadFileDto } from './dto/upload-file.dto';
import { QueryFilesDto } from './dto/query-files.dto';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage.provider';
import {
  MAX_UPLOAD_SIZE_BYTES,
  ORDER_REPORT_ALLOWED_MIME,
  ORDER_REPORT_KIND,
  ORDER_REPORT_KIND_PREFIX,
  orderReportProviderKind,
} from './files.constants';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { ProviderAccountsService } from '../provider-accounts/provider-accounts.service';

type OwnerAction = 'upload' | 'view' | 'delete';

interface InMemoryFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileEntity) private readonly repo: Repository<FileEntity>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly providerAccounts: ProviderAccountsService,
  ) {}

  // ---- Upload (server-side) ---------------------------------------------

  async upload(
    file: InMemoryFile | undefined,
    dto: UploadFileDto,
    user: AuthenticatedUser,
  ): Promise<FileEntity> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo requerido (campo `file`)');
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo (${MAX_UPLOAD_SIZE_BYTES} bytes)`,
      );
    }

    const { allowedContentTypes, kind } = this.policyForOwner(
      dto.ownerType,
      dto.kind ?? null,
    );

    await this.assertOwnerAccess(dto.ownerType, dto.ownerId, user, 'upload', kind);

    if (!this.matchesAnyMime(file.mimetype, allowedContentTypes)) {
      throw new BadRequestException(`Tipo MIME no permitido: ${file.mimetype}`);
    }

    const pathname = this.buildPathname(dto.ownerType, dto.ownerId, kind, file.originalname);
    const uploadResult = await this.storage.upload({
      buffer: file.buffer,
      pathname,
      contentType: file.mimetype,
    });

    const entity = this.repo.create({
      storageProvider: this.storage.name,
      pathname: uploadResult.pathname,
      url: uploadResult.url,
      name: file.originalname,
      mimeType: uploadResult.contentType,
      sizeBytes: String(uploadResult.size),
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      kind,
      uploadedById: user.id,
    });
    return this.repo.save(entity);
  }

  private policyForOwner(
    ownerType: FileOwnerType,
    requestedKind: string | null,
  ): { allowedContentTypes: string[]; kind: string } {
    if (ownerType === 'order') {
      const kind = requestedKind ?? ORDER_REPORT_KIND;
      if (!kind.startsWith(ORDER_REPORT_KIND_PREFIX)) {
        throw new BadRequestException(
          `kind no soportado para órdenes: ${kind}`,
        );
      }
      return { allowedContentTypes: ORDER_REPORT_ALLOWED_MIME, kind };
    }
    throw new BadRequestException(`ownerType no soportado: ${ownerType}`);
  }

  private buildPathname(
    ownerType: FileOwnerType,
    ownerId: string,
    kind: string,
    originalname: string,
  ): string {
    const safe = originalname.replace(/[^\w.\-]+/g, '_').slice(0, 200);
    return `${ownerType}s/${ownerId}/${kind}/${safe}`;
  }

  private matchesAnyMime(mime: string, allowed: string[]): boolean {
    return allowed.some((a) => {
      if (a.endsWith('/*')) return mime.startsWith(a.slice(0, -1));
      return a === mime;
    });
  }

  // ---- Listado / Get ----------------------------------------------------

  async list(q: QueryFilesDto, user: AuthenticatedUser): Promise<FileEntity[]> {
    await this.assertOwnerAccess(q.ownerType, q.ownerId, user, 'view', q.kind ?? null);
    return this.repo.find({
      where: {
        ownerType: q.ownerType,
        ownerId: q.ownerId,
        ...(q.kind ? { kind: q.kind } : {}),
        deletedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
      relations: { uploadedBy: true },
    });
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<FileEntity> {
    const file = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { uploadedBy: true },
    });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    await this.assertOwnerAccess(file.ownerType, file.ownerId, user, 'view', file.kind);
    return file;
  }

  // ---- Download (BE proxy — el FE no ve la URL real) -------------------

  async download(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    file: FileEntity;
    contentLength: number | null;
  }> {
    const file = await this.findOne(id, user);
    const result = await this.storage.download(file.url);
    return { stream: result.stream, file, contentLength: result.contentLength };
  }

  // ---- Delete (hard — quita del storage también) ------------------------

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const file = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    await this.assertOwnerAccess(file.ownerType, file.ownerId, user, 'delete', file.kind);
    await this.storage.delete(file.url);
    await this.repo.softDelete(file.id);
  }

  // ---- Owner-based perm + visibility checks -----------------------------

  private async assertOwnerAccess(
    ownerType: FileOwnerType,
    ownerId: string,
    user: AuthenticatedUser,
    action: OwnerAction,
    kind?: string | null,
  ): Promise<void> {
    if (ownerType === 'order') {
      const order = await this.ordersRepo.findOne({
        where: { id: ownerId, deletedAt: IsNull() },
        relations: { orderServiceTypes: true },
      });
      if (!order) throw new NotFoundException('Orden no encontrada');

      // Usuario proveedor: solo órdenes donde participa; gestiona (upload/delete)
      // únicamente los archivos de SU propio segmento (kind por proveedor).
      const provider = user.isSuperAdmin
        ? null
        : await this.providerAccounts.findProviderByUserId(user.id);
      if (provider) {
        const onOrder = (order.orderServiceTypes ?? []).some((ost) =>
          provider.type === 'doctor'
            ? ost.doctorId === provider.id
            : ost.careCenterId === provider.id,
        );
        if (!onOrder) {
          throw new ForbiddenException('Sin acceso a esta orden');
        }
        if (action !== 'view') {
          const ownKind = orderReportProviderKind(provider.type, provider.id);
          if (kind !== ownKind) {
            throw new ForbiddenException(
              'Solo podés gestionar los archivos de tu propio informe',
            );
          }
        }
        return;
      }

      if (!user.isSuperAdmin) {
        const allowed = await this.resolveUserBranchIds(user);
        if (!allowed.includes(order.branchId)) {
          throw new ForbiddenException('Sin acceso a la sucursal de la orden');
        }
      }

      if (action === 'view') {
        const canList =
          user.isSuperAdmin ||
          user.permissions.includes(PERMISSIONS.ORDERS.LIST) ||
          user.permissions.includes(PERMISSIONS.ORDERS.STAGE_REPORT);
        if (!canList) {
          throw new ForbiddenException('Sin permiso para ver archivos de la orden');
        }
        return;
      }

      const canManage =
        user.isSuperAdmin || user.permissions.includes(PERMISSIONS.ORDERS.STAGE_REPORT);
      if (!canManage) {
        throw new ForbiddenException(
          'Necesitás el permiso orders.stage-report para gestionar archivos del informe',
        );
      }
      // Archivos del informe + `otherStudies` son editables retroactivamente
      // (incluso post-`finalized`/`cancelled`). El resto de la orden sigue
      // inmutable según las reglas de transición en `OrdersService`.
      return;
    }
    throw new BadRequestException(`ownerType no soportado: ${ownerType}`);
  }

  private async resolveUserBranchIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.isSuperAdmin) {
      const all = await this.branchesRepo.find({
        where: { isActive: true, deletedAt: IsNull() },
      });
      return all.map((b) => b.id);
    }
    const u = await this.usersRepo.findOne({
      where: { id: user.id },
      relations: { branches: true },
    });
    return (u?.branches ?? []).map((b) => b.id);
  }
}

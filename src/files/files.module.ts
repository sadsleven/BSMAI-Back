import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileEntity } from './entities/file.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { VercelBlobProvider } from './storage/vercel-blob.provider';

/**
 * Binding del `StorageProvider`. Para migrar a MinIO/S3:
 *  1. Crear `MinioStorageProvider implements StorageProvider`.
 *  2. Cambiar `useClass: VercelBlobProvider` → `useClass: MinioStorageProvider`.
 *  3. Actualizar `BLOB_READ_WRITE_TOKEN` env por las credenciales del nuevo
 *     proveedor.
 *  4. Actualizar `afmi-front/src/modules/files/infrastructure/filesGateway.ts`
 *     para usar el flujo de upload del nuevo provider (presigned URL, etc.).
 * El resto del backend (controller, service, modules consumidores) NO cambia.
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([FileEntity, Order, Branch, User]),
  ],
  providers: [
    FilesService,
    { provide: STORAGE_PROVIDER, useClass: VercelBlobProvider },
  ],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}

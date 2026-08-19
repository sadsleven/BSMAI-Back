import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileEntity } from './entities/file.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ProviderAccountsModule } from '../provider-accounts/provider-accounts.module';
import { STORAGE_PROVIDER } from './storage/storage.provider';
import { VercelBlobProvider } from './storage/vercel-blob.provider';
import { MinioStorageProvider } from './storage/minio.provider';
import { StorageRegistry } from './storage/storage.registry';
import { defaultStorageProvider } from './storage/storage.factory';

/**
 * Storage con dos providers vivos a la vez:
 *  - `MinioStorageProvider`  → producción en el servidor Linux (docker compose).
 *  - `VercelBlobProvider`    → deploy dev en Vercel (serverless, sin MinIO).
 *
 * `STORAGE_PROVIDER` = provider por defecto (recibe los uploads nuevos), lo
 * elige `resolveStorageDriver()` con el env `STORAGE_DRIVER` (`minio` |
 * `vercel_blob` | `auto`, default `auto`).
 *
 * `StorageRegistry` resuelve por `files.storageProvider` para download/delete,
 * así los archivos subidos antes de migrar de proveedor siguen funcionando.
 * Controller, service y módulos consumidores (orders) NO cambian.
 */
@Module({
  imports: [
    AuthModule,
    ProviderAccountsModule,
    TypeOrmModule.forFeature([FileEntity, Order, Branch, User]),
  ],
  providers: [
    FilesService,
    VercelBlobProvider,
    MinioStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, VercelBlobProvider, MinioStorageProvider],
      useFactory: (
        config: ConfigService,
        vercel: VercelBlobProvider,
        minio: MinioStorageProvider,
      ) => defaultStorageProvider(config, vercel, minio),
    },
    StorageRegistry,
  ],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}

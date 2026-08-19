import { Inject, Injectable, Logger } from '@nestjs/common';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';
import { VercelBlobProvider } from './vercel-blob.provider';
import { MinioStorageProvider } from './minio.provider';

/**
 * Resuelve el provider por el nombre guardado en `files.storageProvider`.
 *
 * Los uploads nuevos van al provider por defecto (`STORAGE_PROVIDER`), pero las
 * filas viejas siguen apuntando al backend con el que se subieron: al pasar de
 * Vercel Blob a MinIO, los archivos históricos se descargan/borran igual.
 * Sin registry, un `download` post-migración buscaría el blob de Vercel en
 * MinIO y devolvería 404.
 */
@Injectable()
export class StorageRegistry {
  private readonly logger = new Logger(StorageRegistry.name);
  private readonly byName: Map<string, StorageProvider>;

  constructor(
    vercel: VercelBlobProvider,
    minio: MinioStorageProvider,
    @Inject(STORAGE_PROVIDER) private readonly defaultProvider: StorageProvider,
  ) {
    this.byName = new Map<string, StorageProvider>([
      [vercel.name, vercel],
      [minio.name, minio],
    ]);
  }

  get default(): StorageProvider {
    return this.defaultProvider;
  }

  resolve(name?: string | null): StorageProvider {
    if (!name) return this.defaultProvider;
    const provider = this.byName.get(name);
    if (provider) return provider;
    this.logger.warn(
      `storageProvider desconocido "${name}" — se usa el provider por defecto (${this.defaultProvider.name})`,
    );
    return this.defaultProvider;
  }
}

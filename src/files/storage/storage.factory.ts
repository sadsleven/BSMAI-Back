import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isServerlessRuntime } from '../../shared/utils/runtime.util';
import type { StorageProvider } from './storage.provider';
import { VercelBlobProvider } from './vercel-blob.provider';
import { MinioStorageProvider } from './minio.provider';

export type StorageDriver = 'minio' | 'vercel_blob';

const logger = new Logger('StorageFactory');

/**
 * Driver de storage efectivo.
 *
 * `STORAGE_DRIVER` manda: `minio` | `vercel_blob` (alias `vercel`, `blob`).
 * Vacío o `auto` (default) decide por entorno:
 *   - serverless (Vercel/Lambda) → `vercel_blob` (no hay MinIO alcanzable);
 *   - resto (Docker/bare metal) → `minio` si está configurado, si no `vercel_blob`.
 *
 * Así el mismo repo sirve para el deploy dev en Vercel y para producción en el
 * servidor con Docker sin tocar código.
 */
export function resolveStorageDriver(config: ConfigService): StorageDriver {
  const raw = config.get<string>('STORAGE_DRIVER')?.trim().toLowerCase();

  if (raw === 'minio' || raw === 's3') return 'minio';
  if (raw === 'vercel_blob' || raw === 'vercel' || raw === 'blob')
    return 'vercel_blob';
  if (raw && raw !== 'auto') {
    logger.warn(`STORAGE_DRIVER desconocido: "${raw}" — se usa autodetección`);
  }

  if (isServerlessRuntime()) return 'vercel_blob';
  return isMinioConfigured(config) ? 'minio' : 'vercel_blob';
}

function isMinioConfigured(config: ConfigService): boolean {
  const has = (key: string) => !!config.get<string>(key)?.trim();
  const hasCreds =
    (has('MINIO_ACCESS_KEY') || has('MINIO_ROOT_USER')) &&
    (has('MINIO_SECRET_KEY') || has('MINIO_ROOT_PASSWORD'));
  return has('MINIO_ENDPOINT') && has('MINIO_BUCKET') && hasCreds;
}

/** Provider por defecto — el que recibe los uploads nuevos. */
export function defaultStorageProvider(
  config: ConfigService,
  vercel: VercelBlobProvider,
  minio: MinioStorageProvider,
): StorageProvider {
  const driver = resolveStorageDriver(config);
  logger.log(`Storage activo: ${driver}`);
  if (driver === 'minio') {
    // No bloquea el arranque: sólo deja constancia en logs si no responde.
    void minio.checkConnection();
    return minio;
  }
  return vercel;
}

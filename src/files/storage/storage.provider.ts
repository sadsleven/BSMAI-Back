/**
 * Capa de abstracción de storage. Único punto de cambio al migrar de
 * proveedor. Resto del backend (controller/service/orders) NO cambia.
 *
 * Implementaciones vivas:
 *  - `MinioStorageProvider` (`minio`)       → producción, docker compose.
 *  - `VercelBlobProvider`   (`vercel_blob`) → deploy dev en Vercel.
 * El provider por defecto lo elige `storage.factory.ts` según `STORAGE_DRIVER`;
 * `StorageRegistry` resuelve por `files.storageProvider` para download/delete.
 *
 * Diseño: upload server-side. El archivo viaja FE → BE (multipart) → storage.
 * Token/credenciales del proveedor permanecen en el servidor. Trade-off en
 * Vercel Serverless: cuerpo HTTP limitado a 4.5 MB por request (en Docker el
 * límite lo pone `MAX_UPLOAD_SIZE_BYTES` + `client_max_body_size` de nginx).
 */

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StorageUploadArgs {
  buffer: Buffer;
  pathname: string;
  contentType: string;
}

export interface StorageUploadResult {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
}

export interface StorageDownloadResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength: number | null;
}

export interface StorageProvider {
  readonly name: string;
  upload(args: StorageUploadArgs): Promise<StorageUploadResult>;
  download(url: string): Promise<StorageDownloadResult>;
  delete(url: string): Promise<void>;
}

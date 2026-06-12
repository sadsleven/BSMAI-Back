import { Readable } from 'stream';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, put } from '@vercel/blob';
import type {
  StorageDownloadResult,
  StorageProvider,
  StorageUploadArgs,
  StorageUploadResult,
} from './storage.provider';

/**
 * Vercel Blob via `@vercel/blob` (server SDK). Upload server-side: el token
 * `BLOB_READ_WRITE_TOKEN` nunca sale del backend.
 *
 * Swap a S3/MinIO: reemplazar este archivo por otro impl de `StorageProvider`
 * y reapuntar el binding en `files.module.ts`. El controller/service y los
 * módulos consumidores (orders) NO cambian.
 */
@Injectable()
export class VercelBlobProvider implements StorageProvider {
  readonly name = 'vercel_blob';
  private readonly logger = new Logger(VercelBlobProvider.name);

  constructor(private readonly config: ConfigService) {}

  private getToken(): string {
    const token = this.config.get<string>('BLOB_READ_WRITE_TOKEN');
    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN no configurado');
    }
    return token;
  }

  async upload(args: StorageUploadArgs): Promise<StorageUploadResult> {
    const token = this.getToken();
    const result = await put(args.pathname, args.buffer, {
      access: 'private',
      token,
      contentType: args.contentType,
      addRandomSuffix: true,
    });
    return {
      url: result.url,
      pathname: result.pathname,
      size: args.buffer.length,
      contentType: result.contentType ?? args.contentType,
    };
  }

  async download(url: string): Promise<StorageDownloadResult> {
    const token = this.getToken();
    const result = await get(url, { access: 'private', token });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new NotFoundException('Archivo no disponible en storage');
    }
    return {
      stream: Readable.fromWeb(result.stream as any),
      contentType: result.blob.contentType,
      contentLength: result.blob.size,
    };
  }

  async delete(url: string): Promise<void> {
    const token = this.getToken();
    try {
      await del(url, { token });
    } catch (err) {
      this.logger.warn(`No se pudo borrar blob ${url}: ${(err as Error).message}`);
    }
  }
}

import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  StorageDownloadResult,
  StorageProvider,
  StorageUploadArgs,
  StorageUploadResult,
} from './storage.provider';

/**
 * MinIO (S3-compatible) via `@aws-sdk/client-s3`. Provider de producción en el
 * servidor Linux con Docker; el `docker-compose.yml` levanta el servicio
 * `minio` y `minio-init` crea el bucket privado versionado.
 *
 * Upload server-side, igual que `VercelBlobProvider`: el binario va
 * FE → BE (multipart) → MinIO, y la descarga la proxea el backend
 * (`GET /files/:id/download`). El navegador NUNCA habla con MinIO
 * directamente ⇒ **MinIO no necesita estar publicado a internet** y no hacen
 * falta URLs firmadas. Las credenciales nunca salen del servidor.
 *
 * Al ser genérico S3 sirve igual para DigitalOcean Spaces / AWS S3: sólo
 * cambian `MINIO_ENDPOINT`, `MINIO_REGION` y las llaves.
 *
 * `MINIO_PUBLIC_ENDPOINT` es opcional y sólo cosmético: define el prefijo de la
 * URL que se guarda en `files.url`. La resolución del objeto usa el *path* de
 * esa URL, así que cambiar el endpoint después no rompe los archivos viejos.
 */
@Injectable()
export class MinioStorageProvider implements StorageProvider {
  readonly name = 'minio';
  private readonly logger = new Logger(MinioStorageProvider.name);
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  // ---- Config -----------------------------------------------------------

  private str(key: string): string | undefined {
    const raw = this.config.get<string>(key);
    const value = raw?.trim();
    return value ? value : undefined;
  }

  private cfg(): {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    publicEndpoint: string;
  } {
    const endpoint = this.str('MINIO_ENDPOINT');
    const bucket = this.str('MINIO_BUCKET');
    // Preferimos un service account dedicado; caemos a las root creds del compose.
    const accessKeyId = this.str('MINIO_ACCESS_KEY') ?? this.str('MINIO_ROOT_USER');
    const secretAccessKey =
      this.str('MINIO_SECRET_KEY') ?? this.str('MINIO_ROOT_PASSWORD');

    const missing = [
      !endpoint && 'MINIO_ENDPOINT',
      !bucket && 'MINIO_BUCKET',
      !accessKeyId && 'MINIO_ACCESS_KEY (o MINIO_ROOT_USER)',
      !secretAccessKey && 'MINIO_SECRET_KEY (o MINIO_ROOT_PASSWORD)',
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      throw new Error(`Storage MinIO mal configurado. Falta: ${missing.join(', ')}`);
    }

    const trimTrailing = (u: string) => u.replace(/\/+$/, '');
    return {
      endpoint: trimTrailing(endpoint!),
      bucket: bucket!,
      region: this.str('MINIO_REGION') ?? 'us-east-1',
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      // MinIO habla S3 path-style (`/bucket/key`), no virtual-host style.
      forcePathStyle: this.str('MINIO_FORCE_PATH_STYLE') !== 'false',
      publicEndpoint: trimTrailing(this.str('MINIO_PUBLIC_ENDPOINT') ?? endpoint!),
    };
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const cfg = this.cfg();
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    return this.client;
  }

  /**
   * Chequeo no-bloqueante: avisa en logs si el bucket no responde. No lanza,
   * para no tumbar el arranque de la API si MinIO todavía está levantando.
   */
  async checkConnection(): Promise<boolean> {
    try {
      const cfg = this.cfg();
      await this.getClient().send(new HeadBucketCommand({ Bucket: cfg.bucket }));
      this.logger.log(`MinIO OK — bucket "${cfg.bucket}" en ${cfg.endpoint}`);
      return true;
    } catch (err) {
      // `UnknownError` a secas no dice nada: el SDK lo usa cuando la respuesta
      // no trae cuerpo de error parseable. El status HTTP sí distingue el caso
      // (403 = credenciales/firma, 404 = bucket inexistente, 301 = región).
      this.logger.warn(`MinIO no disponible todavía: ${describeS3Error(err)}`);
      return false;
    }
  }

  // ---- Keys / URLs ------------------------------------------------------

  /** Paridad con `addRandomSuffix` de Vercel Blob: evita colisión de nombres. */
  private withRandomSuffix(pathname: string): string {
    const slash = pathname.lastIndexOf('/');
    const dir = slash >= 0 ? pathname.slice(0, slash + 1) : '';
    const base = slash >= 0 ? pathname.slice(slash + 1) : pathname;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    return `${dir}${stem}-${randomBytes(6).toString('hex')}${ext}`;
  }

  private publicUrl(key: string): string {
    const cfg = this.cfg();
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return cfg.forcePathStyle
      ? `${cfg.publicEndpoint}/${cfg.bucket}/${encoded}`
      : `${cfg.publicEndpoint}/${encoded}`;
  }

  /**
   * Object key desde lo guardado en `files.url`. Sólo usa el path de la URL
   * (no el host) para que cambiar `MINIO_PUBLIC_ENDPOINT` no invalide filas
   * viejas. Acepta también una key cruda.
   */
  private objectKey(urlOrKey: string): string {
    let path = urlOrKey;
    try {
      path = decodeURIComponent(new URL(urlOrKey).pathname);
    } catch {
      // No es URL absoluta → se asume key directa.
    }
    path = path.replace(/^\/+/, '');
    const { bucket } = this.cfg();
    if (path.startsWith(`${bucket}/`)) {
      path = path.slice(bucket.length + 1);
    }
    if (!path) {
      throw new NotFoundException('Ruta de archivo inválida en storage');
    }
    return path;
  }

  // ---- StorageProvider --------------------------------------------------

  async upload(args: StorageUploadArgs): Promise<StorageUploadResult> {
    const cfg = this.cfg();
    const key = this.withRandomSuffix(args.pathname);
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: args.buffer,
        ContentType: args.contentType,
        ContentLength: args.buffer.length,
      }),
    );
    return {
      url: this.publicUrl(key),
      pathname: key,
      size: args.buffer.length,
      contentType: args.contentType,
    };
  }

  async download(url: string): Promise<StorageDownloadResult> {
    const cfg = this.cfg();
    const key = this.objectKey(url);
    try {
      const result = await this.getClient().send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
      if (!result.Body) {
        throw new NotFoundException('Archivo no disponible en storage');
      }
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
        contentLength: result.ContentLength ?? null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      const name = (err as { name?: string }).name;
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
        throw new NotFoundException('Archivo no disponible en storage');
      }
      throw err;
    }
  }

  async delete(url: string): Promise<void> {
    try {
      const cfg = this.cfg();
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: this.objectKey(url) }),
      );
    } catch (err) {
      this.logger.warn(`No se pudo borrar objeto ${url}: ${(err as Error).message}`);
    }
  }
}

/**
 * Mensaje diagnóstico de un error del SDK de S3. `err.message` suele venir
 * vacío o como `UnknownError` en respuestas sin cuerpo (HeadObject/HeadBucket),
 * así que se agregan `name`, status HTTP y el hint del caso más probable.
 */
export function describeS3Error(err: unknown): string {
  const e = err as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
    Code?: string;
  };
  const status = e.$metadata?.httpStatusCode;
  const hint =
    status === 403
      ? ' — credenciales inválidas (MINIO_ACCESS_KEY/SECRET_KEY o MINIO_ROOT_USER/PASSWORD)'
      : status === 404
        ? ' — el bucket no existe (créalo: mc mb local/<bucket>)'
        : status === 301 || status === 400
          ? ' — endpoint/región/path-style mal configurados'
          : '';
  const parts = [
    e.name ?? 'Error',
    e.Code && e.Code !== e.name ? `(${e.Code})` : null,
    status ? `HTTP ${status}` : null,
    e.message && e.message !== e.name ? e.message : null,
  ].filter(Boolean);
  return `${parts.join(' ')}${hint}`;
}

import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { resolveStorageDriver } from './storage.factory';
import { MinioStorageProvider } from './minio.provider';
import { StorageRegistry } from './storage.registry';
import type { StorageProvider } from './storage.provider';

const configOf = (env: Record<string, string | undefined>): ConfigService =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

const MINIO_ENV = {
  MINIO_ENDPOINT: 'http://minio:9000',
  MINIO_BUCKET: 'afmi-files',
  MINIO_ROOT_USER: 'afmi-admin',
  MINIO_ROOT_PASSWORD: 'secret-clave',
};

describe('resolveStorageDriver', () => {
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('respeta STORAGE_DRIVER explícito por encima del entorno', () => {
    process.env.VERCEL = '1';
    expect(resolveStorageDriver(configOf({ STORAGE_DRIVER: 'minio' }))).toBe(
      'minio',
    );
    delete process.env.VERCEL;
    expect(
      resolveStorageDriver(
        configOf({ ...MINIO_ENV, STORAGE_DRIVER: 'vercel_blob' }),
      ),
    ).toBe('vercel_blob');
  });

  it('en serverless cae a vercel_blob aunque MinIO esté configurado', () => {
    process.env.VERCEL = '1';
    expect(resolveStorageDriver(configOf(MINIO_ENV))).toBe('vercel_blob');
  });

  it('fuera de serverless usa minio si está configurado', () => {
    delete process.env.VERCEL;
    expect(resolveStorageDriver(configOf(MINIO_ENV))).toBe('minio');
  });

  it('sin config de MinIO cae a vercel_blob', () => {
    delete process.env.VERCEL;
    expect(resolveStorageDriver(configOf({}))).toBe('vercel_blob');
    // Endpoint y bucket sin credenciales no alcanza.
    expect(
      resolveStorageDriver(
        configOf({
          MINIO_ENDPOINT: 'http://minio:9000',
          MINIO_BUCKET: 'afmi-files',
        }),
      ),
    ).toBe('vercel_blob');
  });

  it('driver desconocido cae a autodetección', () => {
    delete process.env.VERCEL;
    expect(
      resolveStorageDriver(configOf({ ...MINIO_ENV, STORAGE_DRIVER: 'ftp' })),
    ).toBe('minio');
  });
});

describe('MinioStorageProvider', () => {
  type Internals = {
    objectKey(urlOrKey: string): string;
    publicUrl(key: string): string;
    withRandomSuffix(pathname: string): string;
    cfg(): { endpoint: string; publicEndpoint: string; accessKeyId: string };
  };
  const provider = (env: Record<string, string | undefined> = MINIO_ENV) =>
    new MinioStorageProvider(configOf(env)) as unknown as Internals;

  it('lanza si falta configuración', () => {
    expect(() => provider({}).cfg()).toThrow(/MINIO_ENDPOINT/);
  });

  it('prefiere el service account sobre las root creds', () => {
    const cfg = provider({
      ...MINIO_ENV,
      MINIO_ACCESS_KEY: 'svc',
      MINIO_SECRET_KEY: 'k',
    }).cfg();
    expect(cfg.accessKeyId).toBe('svc');
    expect(provider().cfg().accessKeyId).toBe('afmi-admin');
  });

  it('usa MINIO_ENDPOINT como público cuando no hay MINIO_PUBLIC_ENDPOINT', () => {
    expect(provider().publicUrl('orders/abc/report/x.pdf')).toBe(
      'http://minio:9000/afmi-files/orders/abc/report/x.pdf',
    );
    expect(
      provider({
        ...MINIO_ENV,
        MINIO_PUBLIC_ENDPOINT: 'https://archivos.afmi.com.ve/',
      }).publicUrl('orders/abc/report/x.pdf'),
    ).toBe('https://archivos.afmi.com.ve/afmi-files/orders/abc/report/x.pdf');
  });

  it('objectKey ignora el host: sobrevive cambiar el endpoint público', () => {
    const p = provider();
    const key = 'orders/abc/order_report_attachment/informe-1a2b3c.pdf';
    expect(p.objectKey(`http://minio:9000/afmi-files/${key}`)).toBe(key);
    expect(p.objectKey(`https://archivos.afmi.com.ve/afmi-files/${key}`)).toBe(
      key,
    );
    // Key cruda y URL sin el bucket en el path (virtual-host style).
    expect(p.objectKey(key)).toBe(key);
    expect(p.objectKey(`https://afmi-files.s3.example.com/${key}`)).toBe(key);
  });

  it('objectKey decodifica nombres con espacios y acentos', () => {
    expect(
      provider().objectKey(
        'http://minio:9000/afmi-files/orders/1/k/informe%20m%C3%A9dico.pdf',
      ),
    ).toBe('orders/1/k/informe médico.pdf');
  });

  it('objectKey rechaza rutas vacías', () => {
    expect(() => provider().objectKey('http://minio:9000/afmi-files/')).toThrow(
      NotFoundException,
    );
  });

  it('withRandomSuffix conserva carpeta y extensión', () => {
    const out = provider().withRandomSuffix('orders/abc/kind/informe.pdf');
    expect(out).toMatch(/^orders\/abc\/kind\/informe-[0-9a-f]{12}\.pdf$/);
    expect(provider().withRandomSuffix('sin-extension')).toMatch(
      /^sin-extension-[0-9a-f]{12}$/,
    );
  });
});

describe('StorageRegistry', () => {
  const fake = (name: string): StorageProvider =>
    ({ name }) as unknown as StorageProvider;
  const vercel = fake('vercel_blob') as never;
  const minio = fake('minio') as never;

  it('resuelve por el nombre guardado en la fila', () => {
    const registry = new StorageRegistry(vercel, minio, minio);
    expect(registry.resolve('vercel_blob').name).toBe('vercel_blob');
    expect(registry.resolve('minio').name).toBe('minio');
  });

  it('sin nombre o con nombre desconocido usa el default', () => {
    const registry = new StorageRegistry(vercel, minio, minio);
    expect(registry.resolve(null).name).toBe('minio');
    expect(registry.resolve('s3-viejo').name).toBe('minio');
    expect(registry.default.name).toBe('minio');
  });
});

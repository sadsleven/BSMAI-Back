/** Owner types soportados. Ampliar acá + en `FileEntity.ownerType`. */
export const FILE_OWNER_TYPES = ['order'] as const;
export type FileOwnerType = (typeof FILE_OWNER_TYPES)[number];

/**
 * Tipos MIME aceptados para adjuntos de informe (Paso 3 órdenes).
 * PDF e imágenes (informes escaneados) + Office (Word/Excel, formatos nuevos y
 * legacy) porque los laboratorios envían resultados en `.xlsx` / `.docx`.
 * Espejado en el FE: `ACCEPT` de `OrderReportStep.tsx`.
 */
export const ORDER_REPORT_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  // Excel: .xlsx / .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  // Word: .docx / .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const ORDER_REPORT_KIND = 'order_report_attachment';

/**
 * Prefijo común de todos los `kind` de adjuntos de informe (Paso 3). Cubre los
 * adjuntos generales (`order_report_attachment`) y los segmentados por proveedor
 * (`order_report:doctor:<id>` / `order_report:care_center:<id>`).
 */
export const ORDER_REPORT_KIND_PREFIX = 'order_report';

/** `kind` de los adjuntos del informe de un proveedor específico. */
export function orderReportProviderKind(
  providerType: 'doctor' | 'care_center',
  providerId: string,
): string {
  return `${ORDER_REPORT_KIND_PREFIX}:${providerType}:${providerId}`;
}

/**
 * Tope por archivo, en MB, desde `MAX_UPLOAD_SIZE_MB` (default 4).
 *
 * El default conservador viene del cap ~4.5 MB que Vercel Serverless impone al
 * cuerpo HTTP: subirlo en ese deploy no sirve, la plataforma corta antes. En el
 * servidor con MinIO no existe ese techo → poner p. ej. `MAX_UPLOAD_SIZE_MB=25`
 * en el `.env` (y `client_max_body_size` de nginx igual o mayor).
 *
 * Se lee de `process.env` al cargar el módulo porque el límite de multer vive en
 * un decorador (`FileInterceptor`); `src/main.ts` importa `dotenv/config` de
 * primero para que el `.env` ya esté cargado en ese momento.
 */
function resolveMaxUploadMb(): number {
  const raw = Number(process.env.MAX_UPLOAD_SIZE_MB);
  return Number.isFinite(raw) && raw > 0 ? raw : 4;
}

export const MAX_UPLOAD_SIZE_MB = resolveMaxUploadMb();
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

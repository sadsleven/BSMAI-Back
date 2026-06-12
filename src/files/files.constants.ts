/** Owner types soportados. Ampliar acá + en `FileEntity.ownerType`. */
export const FILE_OWNER_TYPES = ['order'] as const;
export type FileOwnerType = (typeof FILE_OWNER_TYPES)[number];

/** Tipos MIME aceptados para adjuntos de informe (Paso 3 órdenes). */
export const ORDER_REPORT_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
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
 * Tope global por archivo: 4 MB. Encaja bajo el cap ~4.5 MB de Vercel
 * Serverless (body HTTP). Vercel Blob plan free admite hasta 5 TB totales,
 * el tope per-archivo es por el límite del runtime no del storage.
 */
export const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;

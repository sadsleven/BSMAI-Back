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
 * Tope global por archivo: 4 MB. Encaja bajo el cap ~4.5 MB de Vercel
 * Serverless (body HTTP). Vercel Blob plan free admite hasta 5 TB totales,
 * el tope per-archivo es por el límite del runtime no del storage.
 */
export const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;

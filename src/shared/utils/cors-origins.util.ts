/**
 * Lee `CORS_ORIGIN` (coma-separada, sin espacios sobrantes por entrada).
 * - Sin variable, vacío o `*`: origen comodín HTTP (`*`), sin `credentials` entre dominios.
 * - Una o más URLs: lista o string único; `credentials: true` (cookies / Authorization con credenciales).
 */
export function getCorsOriginConfig(): {
  origin: string | string[];
  credentials: boolean;
} {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') {
    return { origin: '*', credentials: false };
  }
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0) {
    return { origin: '*', credentials: false };
  }
  if (list.length === 1) {
    return { origin: list[0], credentials: true };
  }
  return { origin: list, credentials: true };
}

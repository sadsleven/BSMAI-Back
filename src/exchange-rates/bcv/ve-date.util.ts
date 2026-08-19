import { VE_TIME_ZONE, VE_UTC_OFFSET } from './bcv.constants';

/**
 * Helpers de fecha en hora de Venezuela sin dependencias extra: `Intl` alcanza
 * porque Venezuela es UTC-04:00 fijo (no hay horario de verano) y `en-CA`
 * formatea como `YYYY-MM-DD`.
 */

/** Día calendario (`YYYY-MM-DD`) del instante dado, en hora de Venezuela. */
export function veDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Medianoche de un día `YYYY-MM-DD` en Venezuela, como ISO con offset. */
export function veDayStartIso(day: string): string {
  return `${day}T00:00:00${VE_UTC_OFFSET}`;
}

/** Día siguiente a un `YYYY-MM-DD` (aritmética sobre la medianoche VE). */
export function veNextDay(day: string): string {
  const start = new Date(veDayStartIso(day));
  return veDay(new Date(start.getTime() + 24 * 60 * 60 * 1000));
}

/**
 * `true` si `a` es un día calendario posterior a `b`. Ambos `YYYY-MM-DD`, así
 * que la comparación lexicográfica es correcta.
 */
export function isDayAfter(a: string, b: string): boolean {
  return a > b;
}

/** Día calendario VE de una fecha efectiva guardada (string ISO o `Date`). */
export function veDayOf(value: string | Date): string {
  return veDay(value instanceof Date ? value : new Date(value));
}

/**
 * Helpers para generar identificadores únicos en tests — evita colisiones de
 * unique constraints (email, RIF, cédula, etc.) cuando los e2e se ejecutan
 * múltiples veces contra la misma DB.
 */

const seed = Date.now();
let counter = 0;

function next(): string {
  counter += 1;
  return `${seed}_${counter}`;
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}_${next()}@afmi.test`;
}

export function uniqueName(prefix = 'E2E'): string {
  return `${prefix} ${next()}`;
}

/** Cédula venezolana: V- + 8 dígitos formateados (V-XX.XXX.XXX). */
export function uniqueCedula(): string {
  const n = (10_000_000 + ((Date.now() + counter++) % 89_999_999)).toString();
  const formatted = `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}`;
  return `V-${formatted}`;
}

/** RIF venezolano J- + 8 dígitos + DV (sin puntos). Patrón J-XXXXXXXX-D. */
export function uniqueRif(letter: 'J' | 'V' | 'G' | 'E' = 'J'): string {
  const n = (10_000_000 + ((Date.now() + counter++) % 89_999_999)).toString();
  const dv = ((parseInt(n, 10) * 7) % 10).toString();
  return `${letter}-${n}-${dv}`;
}

/** Teléfono venezolano 11 dígitos comenzando en 04. */
export function uniquePhone(): string {
  const tail = (1_000_000 + ((Date.now() + counter++) % 8_999_999))
    .toString()
    .slice(0, 7);
  return `0412${tail}`;
}

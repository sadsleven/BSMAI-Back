/**
 * Formatos venezolanos compartidos entre Pacientes, Doctores y Centros de Atención.
 *
 * Cédula: `V-XX.XXX.XXX` o `E-XX.XXX.XXX` (prefijo + 7-8 dígitos con puntos de miles).
 * RIF:    `J-XXXXXXXX-X` (prefijo J/G/V/E + 7-8 dígitos SIN puntos + guión + dígito verificador).
 * Phone:  exactamente 11 dígitos numéricos.
 */

export const CEDULA_PATTERN = /^[VEve]-\d{1,2}\.\d{3}\.\d{3}$/;
export const RIF_PATTERN = /^[JGVEjgve]-\d{7,8}-\d$/;
export const PHONE_PATTERN = /^\d{11}$/;

export const CEDULA_MESSAGE =
  'La cédula debe tener formato V-XX.XXX.XXX o E-XX.XXX.XXX';
export const RIF_MESSAGE =
  'El RIF debe tener formato J-XXXXXXXX-X (sin puntos; prefijos J, G, V o E)';
export const PHONE_MESSAGE = 'El teléfono debe tener exactamente 11 dígitos';

/** Normaliza la cédula a mayúsculas: `v-12.345.678` → `V-12.345.678`. */
export function normalizeCedula(value: string): string {
  return value.trim().toUpperCase();
}

/** Normaliza el RIF a mayúsculas y sin puntos: `j-12.345.678-1` → `J-12345678-1`. */
export function normalizeRif(value: string): string {
  return value.trim().toUpperCase().replace(/\./g, '');
}

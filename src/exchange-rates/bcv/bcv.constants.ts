/** Zona horaria de Venezuela. Fija en UTC-04:00, sin horario de verano. */
export const VE_TIME_ZONE = 'America/Caracas';

/** Offset fijo de Venezuela, para armar los ISO 8601 de `effectiveDate`. */
export const VE_UTC_OFFSET = '-04:00';

/** Página del BCV con el tipo de cambio de referencia. */
export const BCV_DEFAULT_URL = 'https://www.bcv.org.ve/';

/**
 * `id` del div de cada moneda en la home del BCV. La estructura es:
 *
 * ```html
 * <div id="dolar" class="col-sm-12 col-xs-12">
 *   <div class="field-content"><div class="row recuadrotsmc">
 *     <div class="col-sm-6 col-xs-6"><img><span> USD</span></div>
 *     <div class="col-sm-6 col-xs-6 centrado textp"><strong class="strong-tb">772,54410000</strong></div>
 *   </div></div>
 * </div>
 * ```
 */
export const BCV_CURRENCY_ELEMENT_ID = {
  USD: 'dolar',
  EUR: 'euro',
} as const;

/**
 * Contenedor de la fecha de vigencia:
 *
 * ```html
 * <div class="pull-right dinpro center">
 *   Fecha Valor: <span class="date-display-single" property="dc:date"
 *     datatype="xsd:dateTime" content="2026-08-17T00:00:00-04:00">Lunes, 17 Agosto  2026</span>
 * </div>
 * ```
 */
export const BCV_DATE_CONTAINER_CLASSES = [
  'pull-right',
  'dinpro',
  'center',
] as const;

/** Meses en español, para el fallback de parseo de `Fecha Valor` sin `content`. */
export const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/**
 * Catálogo inicial de bancos venezolanos para Pago Móvil.
 * Sincronizado con `Banks Pago Movil.json` del paquete de diseño.
 *
 * El catálogo real vive en la tabla `banks` y es administrable desde la UI
 * (Administración → Bancos). El seed es insert-only: sólo agrega códigos
 * faltantes y nunca sobreescribe nombres/estados editados por el usuario.
 */
export interface BankSeed {
  codigo: string;
  nombre: string;
}

export const BANKS_SEED: BankSeed[] = [
  { codigo: '0102', nombre: 'Banco de Venezuela (BDV)' },
  { codigo: '0104', nombre: 'Banco Venezolano de Crédito' },
  { codigo: '0105', nombre: 'Banco Mercantil' },
  { codigo: '0108', nombre: 'BBVA Provincial' },
  { codigo: '0114', nombre: 'Bancaribe' },
  { codigo: '0115', nombre: 'Banco Exterior' },
  { codigo: '0128', nombre: 'Banco Caroní' },
  { codigo: '0134', nombre: 'Banesco' },
  { codigo: '0137', nombre: 'Banco Sofitasa' },
  { codigo: '0138', nombre: 'Banco Plaza' },
  { codigo: '0146', nombre: 'Bangente' },
  { codigo: '0151', nombre: 'Banco Fondo Común (BFC)' },
  { codigo: '0156', nombre: '100% Banco' },
  { codigo: '0157', nombre: 'DelSur Banco Universal' },
  { codigo: '0163', nombre: 'Banco del Tesoro' },
  { codigo: '0168', nombre: 'Bancrecer' },
  { codigo: '0171', nombre: 'Banco Activo' },
  { codigo: '0172', nombre: 'Bancamiga Banco Universal' },
  { codigo: '0174', nombre: 'Banplus' },
  { codigo: '0175', nombre: 'Banco Digital de los Trabajadores' },
  { codigo: '0177', nombre: 'Banfanb' },
  { codigo: '0191', nombre: 'Banco Nacional de Crédito (BNC)' },
];

export interface PermissionDefinition {
  name: string;
  resource: string;
  action: string;
  label: string;
  description: string;
  group: string;
}

const USERS_GROUP = 'Usuarios';
const ROLES_GROUP = 'Roles';
const PERMISSIONS_GROUP = 'Permisos';
const SPECIALTIES_GROUP = 'Especialidades';
const PATIENTS_GROUP = 'Pacientes';
const DOCTORS_GROUP = 'Doctores';
const CARE_CENTERS_GROUP = 'Centros de Atención';
const INSURANCES_GROUP = 'Seguros';
const PATHOLOGIES_GROUP = 'Patologías';
const SERVICE_TYPES_GROUP = 'Tipos de servicio';
const CONTRACTORS_GROUP = 'Contratistas';
const EXCHANGE_RATES_GROUP = 'Tasa de cambio';
const BRANCHES_GROUP = 'Sucursales';
const TAX_UNITS_GROUP = 'Unidades tributarias';
const ORDERS_GROUP = 'Órdenes';
const ACCOUNTS_PAYABLE_GROUP = 'Cuentas por pagar';
const ACCOUNTS_RECEIVABLE_GROUP = 'Cuentas por cobrar';
const TAXES_PAYABLE_GROUP = 'Retenciones por pagar';
const REPORTS_GROUP = 'Reportes';
const APP_CONFIG_GROUP = 'Configuración';
const FILES_GROUP = 'Archivos';
const PAYMENT_ACCOUNTS_GROUP = 'Cuentas bancarias';
const BANKS_GROUP = 'Bancos';

const usersPermissions: PermissionDefinition[] = [
  {
    name: 'users.list',
    resource: 'users',
    action: 'list',
    label: 'Listar y ver usuarios',
    description: 'Permite listar y ver el detalle de los usuarios del sistema',
    group: USERS_GROUP,
  },
  {
    name: 'users.create',
    resource: 'users',
    action: 'create',
    label: 'Crear usuarios',
    description: 'Permite crear nuevos usuarios',
    group: USERS_GROUP,
  },
  {
    name: 'users.update',
    resource: 'users',
    action: 'update',
    label: 'Editar usuarios',
    description: 'Permite modificar los datos de un usuario',
    group: USERS_GROUP,
  },
  {
    name: 'users.change-password',
    resource: 'users',
    action: 'change-password',
    label: 'Cambiar contraseña de usuarios',
    description: 'Permite cambiar la contraseña de otros usuarios',
    group: USERS_GROUP,
  },
  {
    name: 'users.toggle-active',
    resource: 'users',
    action: 'toggle-active',
    label: 'Habilitar/Deshabilitar usuarios',
    description: 'Permite habilitar o deshabilitar usuarios',
    group: USERS_GROUP,
  },
  {
    name: 'users.soft-delete',
    resource: 'users',
    action: 'soft-delete',
    label: 'Mover usuarios a la papelera',
    description: 'Permite enviar usuarios a la papelera (borrado lógico)',
    group: USERS_GROUP,
  },
  {
    name: 'users.hard-delete',
    resource: 'users',
    action: 'hard-delete',
    label: 'Eliminar usuarios permanentemente',
    description: 'Permite eliminar usuarios de forma definitiva',
    group: USERS_GROUP,
  },
  {
    name: 'users.restore',
    resource: 'users',
    action: 'restore',
    label: 'Restaurar usuarios',
    description: 'Permite restaurar usuarios desde la papelera',
    group: USERS_GROUP,
  },
];

const rolesPermissions: PermissionDefinition[] = [
  {
    name: 'roles.list',
    resource: 'roles',
    action: 'list',
    label: 'Listar y ver roles',
    description: 'Permite listar y ver el detalle de los roles del sistema',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.create',
    resource: 'roles',
    action: 'create',
    label: 'Crear roles',
    description: 'Permite crear nuevos roles',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.update',
    resource: 'roles',
    action: 'update',
    label: 'Editar roles',
    description: 'Permite modificar los datos de un rol',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.toggle-active',
    resource: 'roles',
    action: 'toggle-active',
    label: 'Habilitar/Deshabilitar roles',
    description: 'Permite habilitar o deshabilitar un rol',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.assign-permissions',
    resource: 'roles',
    action: 'assign-permissions',
    label: 'Asignar permisos a roles',
    description: 'Permite asignar o quitar permisos de un rol',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.soft-delete',
    resource: 'roles',
    action: 'soft-delete',
    label: 'Mover roles a la papelera',
    description: 'Permite enviar roles a la papelera (borrado lógico)',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.hard-delete',
    resource: 'roles',
    action: 'hard-delete',
    label: 'Eliminar roles permanentemente',
    description: 'Permite eliminar roles de forma definitiva',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.restore',
    resource: 'roles',
    action: 'restore',
    label: 'Restaurar roles',
    description: 'Permite restaurar roles desde la papelera',
    group: ROLES_GROUP,
  },
];

const permissionsResourcePermissions: PermissionDefinition[] = [
  {
    name: 'permissions.list',
    resource: 'permissions',
    action: 'list',
    label: 'Listar permisos',
    description: 'Permite ver el catálogo de permisos disponibles',
    group: PERMISSIONS_GROUP,
  },
];

function buildResourcePermissions(
  resource: string,
  group: string,
  labels: Record<string, { label: string; description: string }>,
): PermissionDefinition[] {
  return Object.entries(labels).map(([action, l]) => ({
    name: `${resource}.${action}`,
    resource,
    action,
    label: l.label,
    description: l.description,
    group,
  }));
}

const standardActionLabels = (entity: string, plural: string) => ({
  list: {
    label: `Listar y ver ${plural}`,
    description: `Permite listar y ver el detalle de los ${plural} del sistema`,
  },
  create: {
    label: `Crear ${plural}`,
    description: `Permite crear nuevos ${plural}`,
  },
  update: {
    label: `Editar ${plural}`,
    description: `Permite modificar los datos de un ${entity}`,
  },
  'toggle-active': {
    label: `Habilitar/Deshabilitar ${plural}`,
    description: `Permite habilitar o deshabilitar ${plural}`,
  },
  'soft-delete': {
    label: `Mover ${plural} a la papelera`,
    description: `Permite enviar ${plural} a la papelera (borrado lógico)`,
  },
  'hard-delete': {
    label: `Eliminar ${plural} permanentemente`,
    description: `Permite eliminar ${plural} de forma definitiva`,
  },
  restore: {
    label: `Restaurar ${plural}`,
    description: `Permite restaurar ${plural} desde la papelera`,
  },
});

const specialtiesPermissions = buildResourcePermissions(
  'specialties',
  SPECIALTIES_GROUP,
  standardActionLabels('especialidad', 'especialidades'),
);

const patientsPermissions = buildResourcePermissions(
  'patients',
  PATIENTS_GROUP,
  standardActionLabels('paciente', 'pacientes'),
);

const doctorsPermissions: PermissionDefinition[] = [
  ...buildResourcePermissions(
    'doctors',
    DOCTORS_GROUP,
    standardActionLabels('doctor', 'doctores'),
  ),
  {
    name: 'doctors.change-password',
    resource: 'doctors',
    action: 'change-password',
    label: 'Cambiar contraseña de doctores',
    description:
      'Permite establecer o cambiar la contraseña de acceso de un doctor',
    group: DOCTORS_GROUP,
  },
];

const careCentersPermissions: PermissionDefinition[] = [
  ...buildResourcePermissions(
    'care-centers',
    CARE_CENTERS_GROUP,
    standardActionLabels('centro de atención', 'centros de atención'),
  ),
  {
    name: 'care-centers.change-password',
    resource: 'care-centers',
    action: 'change-password',
    label: 'Cambiar contraseña de centros de atención',
    description:
      'Permite establecer o cambiar la contraseña de acceso de un centro de atención',
    group: CARE_CENTERS_GROUP,
  },
];

const insurancesPermissions = buildResourcePermissions(
  'insurances',
  INSURANCES_GROUP,
  standardActionLabels('seguro', 'seguros'),
);

const pathologiesPermissions = buildResourcePermissions(
  'pathologies',
  PATHOLOGIES_GROUP,
  standardActionLabels('patología', 'patologías'),
);

const serviceTypesPermissions = buildResourcePermissions(
  'service-types',
  SERVICE_TYPES_GROUP,
  standardActionLabels('tipo de servicio', 'tipos de servicio'),
);

const contractorsPermissions = buildResourcePermissions(
  'contractors',
  CONTRACTORS_GROUP,
  standardActionLabels('contratista', 'contratistas'),
);

const exchangeRatesPermissions = buildResourcePermissions(
  'exchange-rates',
  EXCHANGE_RATES_GROUP,
  standardActionLabels('tasa de cambio', 'tasas de cambio'),
);

const branchesPermissions = buildResourcePermissions(
  'branches',
  BRANCHES_GROUP,
  standardActionLabels('sucursal', 'sucursales'),
);

const taxUnitsPermissions = buildResourcePermissions(
  'tax-units',
  TAX_UNITS_GROUP,
  standardActionLabels('unidad tributaria', 'unidades tributarias'),
);

const paymentAccountsPermissions = buildResourcePermissions(
  'payment-accounts',
  PAYMENT_ACCOUNTS_GROUP,
  standardActionLabels('cuenta bancaria', 'cuentas bancarias'),
);

/**
 * Catálogo de bancos: el listado (GET /banks) es JWT-only sin permiso porque
 * popula selects en formularios de cualquier usuario. Sólo las mutaciones
 * llevan permiso; no hay borrado — un banco en desuso se deshabilita.
 */
const banksPermissions = buildResourcePermissions('banks', BANKS_GROUP, {
  create: {
    label: 'Crear bancos',
    description: 'Permite agregar nuevos bancos al catálogo',
  },
  update: {
    label: 'Editar bancos',
    description:
      'Permite modificar el código o nombre de un banco del catálogo',
  },
  'toggle-active': {
    label: 'Habilitar/Deshabilitar bancos',
    description:
      'Permite habilitar o deshabilitar bancos del catálogo (los deshabilitados no aparecen como opción en formularios)',
  },
});

const ordersPermissions: PermissionDefinition[] = [
  {
    name: 'orders.list',
    resource: 'orders',
    action: 'list',
    label: 'Listar y ver órdenes',
    description: 'Permite listar y ver el detalle de las órdenes del sistema',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.create',
    resource: 'orders',
    action: 'create',
    label: 'Crear órdenes',
    description: 'Permite crear nuevas órdenes',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.update',
    resource: 'orders',
    action: 'update',
    label: 'Editar órdenes',
    description:
      'Permite modificar el Paso 1 de órdenes creadas y sin atender (incluye gestión de pagos)',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.cancel',
    resource: 'orders',
    action: 'cancel',
    label: 'Cancelar y reactivar órdenes',
    description:
      'Permite cancelar una orden (conserva su número y detiene el flujo) y revertir la cancelación',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.soft-delete',
    resource: 'orders',
    action: 'soft-delete',
    label: 'Mover órdenes a la papelera',
    description: 'Permite enviar órdenes a la papelera (borrado lógico)',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.hard-delete',
    resource: 'orders',
    action: 'hard-delete',
    label: 'Eliminar órdenes permanentemente',
    description: 'Permite eliminar órdenes de forma definitiva',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.restore',
    resource: 'orders',
    action: 'restore',
    label: 'Restaurar órdenes',
    description: 'Permite restaurar órdenes desde la papelera',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.stage-attention',
    resource: 'orders',
    action: 'stage-attention',
    label: 'Atención del paciente (Paso 2)',
    description: 'Permite acceder al Paso 2 y marcar la orden como atendida',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.stage-report',
    resource: 'orders',
    action: 'stage-report',
    label: 'Informe médico y estudios (Paso 3)',
    description: 'Permite acceder al Paso 3 y emitir el informe médico',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.stage-billing',
    resource: 'orders',
    action: 'stage-billing',
    label: 'Facturación y liquidación (Paso 4)',
    description:
      'Permite acceder al Paso 4 y finalizar la facturación de la orden',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.edit-amount',
    resource: 'orders',
    action: 'edit-amount',
    label: 'Editar monto de la orden (Paso 1)',
    description:
      'Permite modificar el monto de la orden en el Paso 1 (descuentos o montos mayores al sugerido)',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.custom-number',
    resource: 'orders',
    action: 'custom-number',
    label: 'Elegir el número de orden (Paso 1)',
    description:
      'Permite fijar el número de la orden en el Paso 1 (cualquier número libre; por defecto el sistema propone el siguiente)',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.set-provider-amount',
    resource: 'orders',
    action: 'set-provider-amount',
    label: 'Asignar liquidación a proveedores (Paso 4)',
    description:
      'Permite ver y editar el monto de liquidación a doctores/centros en el Paso 4',
    group: ORDERS_GROUP,
  },
];

const accountsPayablePermissions: PermissionDefinition[] = [
  {
    name: 'accounts-payable.list',
    resource: 'accounts-payable',
    action: 'list',
    label: 'Listar y ver cuentas por pagar',
    description: 'Permite listar y ver el detalle de las cuentas por pagar',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
  {
    name: 'accounts-payable.create',
    resource: 'accounts-payable',
    action: 'create',
    label: 'Crear lotes de cuentas por pagar',
    description: 'Permite crear lotes de pago y agregarles órdenes',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
  {
    name: 'accounts-payable.update',
    resource: 'accounts-payable',
    action: 'update',
    label: 'Registrar pagos a cuentas por pagar',
    description:
      'Permite registrar, editar y eliminar pagos al doctor o centro de atención',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
  {
    name: 'accounts-payable.soft-delete',
    resource: 'accounts-payable',
    action: 'soft-delete',
    label: 'Anular lotes de cuentas por pagar',
    description: 'Permite anular un lote y liberar sus órdenes a Pendientes',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
];

const accountsReceivablePermissions: PermissionDefinition[] = [
  {
    name: 'accounts-receivable.list',
    resource: 'accounts-receivable',
    action: 'list',
    label: 'Listar y ver cuentas por cobrar',
    description: 'Permite listar y ver el detalle de las cuentas por cobrar',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
  {
    name: 'accounts-receivable.create',
    resource: 'accounts-receivable',
    action: 'create',
    label: 'Crear lotes de cuentas por cobrar',
    description: 'Permite crear lotes de cobro y agregarles órdenes',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
  {
    name: 'accounts-receivable.update',
    resource: 'accounts-receivable',
    action: 'update',
    label: 'Registrar cobros a cuentas por cobrar',
    description:
      'Permite registrar, editar y eliminar cobros del seguro o del titular (crédito)',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
  {
    name: 'accounts-receivable.soft-delete',
    resource: 'accounts-receivable',
    action: 'soft-delete',
    label: 'Anular lotes de cuentas por cobrar',
    description: 'Permite anular un lote y liberar sus órdenes a Pendientes',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
];

const taxesPayablePermissions: PermissionDefinition[] = [
  {
    name: 'taxes-payable.list',
    resource: 'taxes-payable',
    action: 'list',
    label: 'Listar y ver retenciones por pagar',
    description: 'Permite listar y ver el detalle de las retenciones por pagar',
    group: TAXES_PAYABLE_GROUP,
  },
  {
    name: 'taxes-payable.create',
    resource: 'taxes-payable',
    action: 'create',
    label: 'Crear lotes de retenciones por pagar',
    description: 'Permite crear lotes SENIAT y agregarles retenciones',
    group: TAXES_PAYABLE_GROUP,
  },
  {
    name: 'taxes-payable.update',
    resource: 'taxes-payable',
    action: 'update',
    label: 'Registrar pagos a retenciones por pagar',
    description:
      'Permite registrar, editar y eliminar pagos de la retención al SENIAT',
    group: TAXES_PAYABLE_GROUP,
  },
  {
    name: 'taxes-payable.soft-delete',
    resource: 'taxes-payable',
    action: 'soft-delete',
    label: 'Anular lotes de retenciones por pagar',
    description:
      'Permite anular un lote SENIAT y liberar sus retenciones a Pendientes',
    group: TAXES_PAYABLE_GROUP,
  },
];

const reportsDefs: Array<{ key: string; label: string; description: string }> =
  [
    {
      key: 'receivables',
      label: 'Ver reporte de cuentas por cobrar',
      description: 'Permite acceder al reporte detallado de cuentas por cobrar',
    },
    {
      key: 'payables',
      label: 'Ver reporte de cuentas por pagar',
      description: 'Permite acceder al reporte detallado de cuentas por pagar',
    },
    {
      key: 'financial-summary',
      label: 'Ver resumen financiero',
      description: 'Permite acceder al reporte de ingresos vs egresos por mes',
    },
    {
      key: 'doctor-production',
      label: 'Ver producción por médico',
      description:
        'Permite acceder al reporte de producción agrupada por proveedor',
    },
    {
      key: 'insurance-production',
      label: 'Ver producción por aseguradora',
      description:
        'Permite acceder al reporte de producción agrupada por aseguradora',
    },
    {
      key: 'aging',
      label: 'Ver antigüedad de saldos',
      description:
        'Permite acceder al reporte de aging de cuentas por cobrar y por pagar',
    },
    {
      key: 'collections',
      label: 'Ver reporte de cobros recibidos',
      description:
        'Permite acceder al listado de cobros registrados de aseguradoras',
    },
    {
      key: 'disbursements',
      label: 'Ver reporte de pagos emitidos',
      description:
        'Permite acceder al listado de pagos a proveedores y al SENIAT',
    },
    {
      key: 'orders-tracking',
      label: 'Ver seguimiento de órdenes',
      description: 'Permite acceder al reporte de órdenes por etapa del flujo',
    },
    {
      key: 'services-billed',
      label: 'Ver servicios facturados',
      description: 'Permite acceder al reporte de demanda por tipo de servicio',
    },
    {
      key: 'taxes-retained',
      label: 'Ver reporte de impuestos retenidos',
      description:
        'Permite acceder al reporte detallado de retenciones aplicadas',
    },
    {
      key: 'arc',
      label: 'Ver comprobantes ARC',
      description:
        'Permite descargar los comprobantes ARC anuales de retención por médico o centro de salud',
    },
    {
      key: 'executive-panel',
      label: 'Ver panel ejecutivo',
      description:
        'Permite acceder al panel ejecutivo con gráficos de flujo de caja y órdenes',
    },
    {
      key: 'orders-analytics',
      label: 'Ver análisis de órdenes',
      description:
        'Permite ver la sección de análisis de órdenes (volumen y mezcla) dentro del panel ejecutivo',
    },
    {
      key: 'insurer-collections',
      label: 'Ver cobranzas por aseguradora',
      description:
        'Permite ver la sección de cobranzas por compañía de seguros dentro del panel ejecutivo',
    },
    {
      key: 'payment-account-inflows',
      label: 'Ver dinero recibido por cuenta bancaria',
      description:
        'Permite acceder al reporte de dinero recibido en las cuentas propias (órdenes y cuentas por cobrar)',
    },
  ];

const filesPermissions: PermissionDefinition[] = [
  {
    name: 'files.list',
    resource: 'files',
    action: 'list',
    label: 'Listar y ver archivos',
    description:
      'Permite listar y ver archivos adjuntos asociados a entidades del sistema',
    group: FILES_GROUP,
  },
  {
    name: 'files.create',
    resource: 'files',
    action: 'create',
    label: 'Subir archivos',
    description:
      'Permite subir archivos al storage y asociarlos a entidades del sistema',
    group: FILES_GROUP,
  },
  {
    name: 'files.soft-delete',
    resource: 'files',
    action: 'soft-delete',
    label: 'Eliminar archivos',
    description:
      'Permite eliminar archivos adjuntos (borrado lógico + remoción del storage)',
    group: FILES_GROUP,
  },
];

const appConfigPermissions: PermissionDefinition[] = [
  {
    name: 'app-config.view',
    resource: 'app-config',
    action: 'view',
    label: 'Ver configuración',
    description: 'Permite ver los parámetros de configuración del sistema',
    group: APP_CONFIG_GROUP,
  },
  {
    name: 'app-config.update',
    resource: 'app-config',
    action: 'update',
    label: 'Editar configuración',
    description:
      'Permite modificar los parámetros de configuración del sistema (ej. comisión Cashea)',
    group: APP_CONFIG_GROUP,
  },
];

const reportsPermissions: PermissionDefinition[] = reportsDefs.map((d) => ({
  name: `reports.${d.key}.list`,
  resource: `reports.${d.key}`,
  action: 'list',
  label: d.label,
  description: d.description,
  group: REPORTS_GROUP,
}));

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  ...usersPermissions,
  ...rolesPermissions,
  ...permissionsResourcePermissions,
  ...specialtiesPermissions,
  ...patientsPermissions,
  ...doctorsPermissions,
  ...careCentersPermissions,
  ...insurancesPermissions,
  ...pathologiesPermissions,
  ...serviceTypesPermissions,
  ...contractorsPermissions,
  ...exchangeRatesPermissions,
  ...branchesPermissions,
  ...taxUnitsPermissions,
  ...paymentAccountsPermissions,
  ...banksPermissions,
  ...ordersPermissions,
  ...accountsPayablePermissions,
  ...accountsReceivablePermissions,
  ...taxesPayablePermissions,
  ...appConfigPermissions,
  ...filesPermissions,
  ...reportsPermissions,
];

function buildResourceConst<T extends string>(resource: T) {
  return {
    LIST: `${resource}.list`,
    CREATE: `${resource}.create`,
    UPDATE: `${resource}.update`,
    TOGGLE_ACTIVE: `${resource}.toggle-active`,
    SOFT_DELETE: `${resource}.soft-delete`,
    HARD_DELETE: `${resource}.hard-delete`,
    RESTORE: `${resource}.restore`,
  } as const;
}

export const PERMISSIONS = {
  USERS: {
    LIST: 'users.list',
    CREATE: 'users.create',
    UPDATE: 'users.update',
    CHANGE_PASSWORD: 'users.change-password',
    TOGGLE_ACTIVE: 'users.toggle-active',
    SOFT_DELETE: 'users.soft-delete',
    HARD_DELETE: 'users.hard-delete',
    RESTORE: 'users.restore',
  },
  ROLES: {
    LIST: 'roles.list',
    CREATE: 'roles.create',
    UPDATE: 'roles.update',
    TOGGLE_ACTIVE: 'roles.toggle-active',
    SOFT_DELETE: 'roles.soft-delete',
    HARD_DELETE: 'roles.hard-delete',
    RESTORE: 'roles.restore',
    ASSIGN_PERMISSIONS: 'roles.assign-permissions',
  },
  PERMISSIONS: {
    LIST: 'permissions.list',
  },
  SPECIALTIES: buildResourceConst('specialties'),
  PATIENTS: buildResourceConst('patients'),
  DOCTORS: {
    ...buildResourceConst('doctors'),
    CHANGE_PASSWORD: 'doctors.change-password',
  },
  CARE_CENTERS: {
    ...buildResourceConst('care-centers'),
    CHANGE_PASSWORD: 'care-centers.change-password',
  },
  INSURANCES: buildResourceConst('insurances'),
  PATHOLOGIES: buildResourceConst('pathologies'),
  SERVICE_TYPES: buildResourceConst('service-types'),
  CONTRACTORS: buildResourceConst('contractors'),
  EXCHANGE_RATES: buildResourceConst('exchange-rates'),
  BRANCHES: buildResourceConst('branches'),
  TAX_UNITS: buildResourceConst('tax-units'),
  PAYMENT_ACCOUNTS: buildResourceConst('payment-accounts'),
  BANKS: {
    CREATE: 'banks.create',
    UPDATE: 'banks.update',
    TOGGLE_ACTIVE: 'banks.toggle-active',
  },
  ORDERS: {
    LIST: 'orders.list',
    CREATE: 'orders.create',
    UPDATE: 'orders.update',
    CANCEL: 'orders.cancel',
    SOFT_DELETE: 'orders.soft-delete',
    HARD_DELETE: 'orders.hard-delete',
    RESTORE: 'orders.restore',
    STAGE_ATTENTION: 'orders.stage-attention',
    STAGE_REPORT: 'orders.stage-report',
    STAGE_BILLING: 'orders.stage-billing',
    EDIT_AMOUNT: 'orders.edit-amount',
    CUSTOM_NUMBER: 'orders.custom-number',
    SET_PROVIDER_AMOUNT: 'orders.set-provider-amount',
  },
  ACCOUNTS_PAYABLE: {
    LIST: 'accounts-payable.list',
    CREATE: 'accounts-payable.create',
    UPDATE: 'accounts-payable.update',
    SOFT_DELETE: 'accounts-payable.soft-delete',
  },
  ACCOUNTS_RECEIVABLE: {
    LIST: 'accounts-receivable.list',
    CREATE: 'accounts-receivable.create',
    UPDATE: 'accounts-receivable.update',
    SOFT_DELETE: 'accounts-receivable.soft-delete',
  },
  TAXES_PAYABLE: {
    LIST: 'taxes-payable.list',
    CREATE: 'taxes-payable.create',
    UPDATE: 'taxes-payable.update',
    SOFT_DELETE: 'taxes-payable.soft-delete',
  },
  APP_CONFIG: {
    VIEW: 'app-config.view',
    UPDATE: 'app-config.update',
  },
  FILES: {
    LIST: 'files.list',
    CREATE: 'files.create',
    SOFT_DELETE: 'files.soft-delete',
  },
  REPORTS: {
    RECEIVABLES_LIST: 'reports.receivables.list',
    PAYABLES_LIST: 'reports.payables.list',
    FINANCIAL_SUMMARY_LIST: 'reports.financial-summary.list',
    DOCTOR_PRODUCTION_LIST: 'reports.doctor-production.list',
    INSURANCE_PRODUCTION_LIST: 'reports.insurance-production.list',
    AGING_LIST: 'reports.aging.list',
    COLLECTIONS_LIST: 'reports.collections.list',
    DISBURSEMENTS_LIST: 'reports.disbursements.list',
    ORDERS_TRACKING_LIST: 'reports.orders-tracking.list',
    SERVICES_BILLED_LIST: 'reports.services-billed.list',
    TAXES_RETAINED_LIST: 'reports.taxes-retained.list',
    ARC_LIST: 'reports.arc.list',
    PAYMENT_ACCOUNT_INFLOWS_LIST: 'reports.payment-account-inflows.list',
  },
} as const;

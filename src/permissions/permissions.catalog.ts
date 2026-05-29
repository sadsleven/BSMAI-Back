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
const ORDERS_GROUP = 'Órdenes';
const ACCOUNTS_PAYABLE_GROUP = 'Cuentas por pagar';
const ACCOUNTS_RECEIVABLE_GROUP = 'Cuentas por cobrar';
const CREDITS_RECEIVABLE_GROUP = 'Créditos por cobrar';
const TAXES_PAYABLE_GROUP = 'Impuestos por pagar';
const REPORTS_GROUP = 'Reportes';

const usersPermissions: PermissionDefinition[] = [
  {
    name: 'users.list',
    resource: 'users',
    action: 'list',
    label: 'Listar usuarios',
    description: 'Permite ver el listado de usuarios del sistema',
    group: USERS_GROUP,
  },
  {
    name: 'users.view',
    resource: 'users',
    action: 'view',
    label: 'Ver detalle de usuario',
    description: 'Permite ver el detalle de un usuario específico',
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
    label: 'Listar roles',
    description: 'Permite ver el listado de roles del sistema',
    group: ROLES_GROUP,
  },
  {
    name: 'roles.view',
    resource: 'roles',
    action: 'view',
    label: 'Ver detalle de rol',
    description: 'Permite ver el detalle de un rol específico',
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
  list: { label: `Listar ${plural}`, description: `Permite ver el listado de ${plural} del sistema` },
  view: { label: `Ver detalle de ${entity}`, description: `Permite ver el detalle de un ${entity} específico` },
  create: { label: `Crear ${plural}`, description: `Permite crear nuevos ${plural}` },
  update: { label: `Editar ${plural}`, description: `Permite modificar los datos de un ${entity}` },
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
  restore: { label: `Restaurar ${plural}`, description: `Permite restaurar ${plural} desde la papelera` },
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

const doctorsPermissions = buildResourcePermissions(
  'doctors',
  DOCTORS_GROUP,
  standardActionLabels('doctor', 'doctores'),
);

const careCentersPermissions = buildResourcePermissions(
  'care-centers',
  CARE_CENTERS_GROUP,
  standardActionLabels('centro de atención', 'centros de atención'),
);

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

const ordersPermissions: PermissionDefinition[] = [
  {
    name: 'orders.list',
    resource: 'orders',
    action: 'list',
    label: 'Listar órdenes',
    description: 'Permite ver el listado de órdenes del sistema',
    group: ORDERS_GROUP,
  },
  {
    name: 'orders.view',
    resource: 'orders',
    action: 'view',
    label: 'Ver detalle de orden',
    description: 'Permite ver el detalle de una orden específica',
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
    description: 'Permite modificar órdenes en borrador (incluye gestión de pagos)',
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
    description: 'Permite acceder al Paso 4 y finalizar la facturación de la orden',
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
    label: 'Listar cuentas por pagar',
    description: 'Permite ver el listado de cuentas por pagar',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
  {
    name: 'accounts-payable.view',
    resource: 'accounts-payable',
    action: 'view',
    label: 'Ver detalle de cuenta por pagar',
    description: 'Permite ver el detalle de una cuenta por pagar',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
  {
    name: 'accounts-payable.update',
    resource: 'accounts-payable',
    action: 'update',
    label: 'Registrar pagos a cuentas por pagar',
    description: 'Permite registrar pagos al doctor o centro de atención',
    group: ACCOUNTS_PAYABLE_GROUP,
  },
];

const accountsReceivablePermissions: PermissionDefinition[] = [
  {
    name: 'accounts-receivable.list',
    resource: 'accounts-receivable',
    action: 'list',
    label: 'Listar cuentas por cobrar',
    description: 'Permite ver el listado de cuentas por cobrar',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
  {
    name: 'accounts-receivable.view',
    resource: 'accounts-receivable',
    action: 'view',
    label: 'Ver detalle de cuenta por cobrar',
    description: 'Permite ver el detalle de una cuenta por cobrar',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
  {
    name: 'accounts-receivable.update',
    resource: 'accounts-receivable',
    action: 'update',
    label: 'Registrar cobros a cuentas por cobrar',
    description: 'Permite registrar cobros del seguro',
    group: ACCOUNTS_RECEIVABLE_GROUP,
  },
];

const creditsReceivablePermissions: PermissionDefinition[] = [
  {
    name: 'credits-receivable.list',
    resource: 'credits-receivable',
    action: 'list',
    label: 'Listar créditos por cobrar',
    description: 'Permite ver el listado de créditos por cobrar',
    group: CREDITS_RECEIVABLE_GROUP,
  },
  {
    name: 'credits-receivable.view',
    resource: 'credits-receivable',
    action: 'view',
    label: 'Ver detalle de crédito por cobrar',
    description: 'Permite ver el detalle de un crédito por cobrar',
    group: CREDITS_RECEIVABLE_GROUP,
  },
  {
    name: 'credits-receivable.update',
    resource: 'credits-receivable',
    action: 'update',
    label: 'Registrar cobros a créditos por cobrar',
    description: 'Permite registrar cobros del titular del crédito',
    group: CREDITS_RECEIVABLE_GROUP,
  },
];

const taxesPayablePermissions: PermissionDefinition[] = [
  {
    name: 'taxes-payable.list',
    resource: 'taxes-payable',
    action: 'list',
    label: 'Listar impuestos por pagar',
    description: 'Permite ver el listado de impuestos por pagar',
    group: TAXES_PAYABLE_GROUP,
  },
  {
    name: 'taxes-payable.view',
    resource: 'taxes-payable',
    action: 'view',
    label: 'Ver detalle de impuesto por pagar',
    description: 'Permite ver el detalle de un impuesto por pagar',
    group: TAXES_PAYABLE_GROUP,
  },
  {
    name: 'taxes-payable.update',
    resource: 'taxes-payable',
    action: 'update',
    label: 'Registrar pagos a impuestos por pagar',
    description: 'Permite registrar pagos del impuesto retenido al fisco',
    group: TAXES_PAYABLE_GROUP,
  },
];

const reportsDefs: Array<{ key: string; label: string; description: string }> = [
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
    description: 'Permite acceder al reporte de producción agrupada por proveedor',
  },
  {
    key: 'insurance-production',
    label: 'Ver producción por aseguradora',
    description: 'Permite acceder al reporte de producción agrupada por aseguradora',
  },
  {
    key: 'aging',
    label: 'Ver antigüedad de saldos',
    description: 'Permite acceder al reporte de aging de cuentas por cobrar y por pagar',
  },
  {
    key: 'collections',
    label: 'Ver reporte de cobros recibidos',
    description: 'Permite acceder al listado de cobros registrados de aseguradoras',
  },
  {
    key: 'disbursements',
    label: 'Ver reporte de pagos emitidos',
    description: 'Permite acceder al listado de pagos a proveedores y al fisco',
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
    description: 'Permite acceder al reporte detallado de retenciones aplicadas',
  },
  {
    key: 'executive-panel',
    label: 'Ver panel ejecutivo',
    description: 'Permite acceder al panel ejecutivo con gráficos de flujo de caja y órdenes',
  },
  {
    key: 'orders-analytics',
    label: 'Ver análisis de órdenes',
    description: 'Permite acceder al reporte gráfico de volumen y mezcla de órdenes',
  },
  {
    key: 'insurer-collections',
    label: 'Ver cobranzas por aseguradora',
    description: 'Permite acceder al reporte gráfico de cobranzas por compañía de seguros',
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
  ...ordersPermissions,
  ...accountsPayablePermissions,
  ...accountsReceivablePermissions,
  ...creditsReceivablePermissions,
  ...taxesPayablePermissions,
  ...reportsPermissions,
];

const standardActions = {
  VIEW: 'view',
  LIST: 'list',
  CREATE: 'create',
  UPDATE: 'update',
  TOGGLE_ACTIVE: 'toggle-active',
  SOFT_DELETE: 'soft-delete',
  HARD_DELETE: 'hard-delete',
  RESTORE: 'restore',
} as const;

function buildResourceConst<T extends string>(resource: T) {
  return {
    VIEW: `${resource}.view`,
    LIST: `${resource}.list`,
    CREATE: `${resource}.create`,
    UPDATE: `${resource}.update`,
    TOGGLE_ACTIVE: `${resource}.toggle-active`,
    SOFT_DELETE: `${resource}.soft-delete`,
    HARD_DELETE: `${resource}.hard-delete`,
    RESTORE: `${resource}.restore`,
  } as const;
}

void standardActions;

export const PERMISSIONS = {
  USERS: {
    VIEW: 'users.view',
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
    VIEW: 'roles.view',
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
  DOCTORS: buildResourceConst('doctors'),
  CARE_CENTERS: buildResourceConst('care-centers'),
  INSURANCES: buildResourceConst('insurances'),
  PATHOLOGIES: buildResourceConst('pathologies'),
  SERVICE_TYPES: buildResourceConst('service-types'),
  CONTRACTORS: buildResourceConst('contractors'),
  EXCHANGE_RATES: buildResourceConst('exchange-rates'),
  BRANCHES: buildResourceConst('branches'),
  ORDERS: {
    LIST: 'orders.list',
    VIEW: 'orders.view',
    CREATE: 'orders.create',
    UPDATE: 'orders.update',
    SOFT_DELETE: 'orders.soft-delete',
    HARD_DELETE: 'orders.hard-delete',
    RESTORE: 'orders.restore',
    STAGE_ATTENTION: 'orders.stage-attention',
    STAGE_REPORT: 'orders.stage-report',
    STAGE_BILLING: 'orders.stage-billing',
    EDIT_AMOUNT: 'orders.edit-amount',
    SET_PROVIDER_AMOUNT: 'orders.set-provider-amount',
  },
  ACCOUNTS_PAYABLE: {
    LIST: 'accounts-payable.list',
    VIEW: 'accounts-payable.view',
    UPDATE: 'accounts-payable.update',
  },
  ACCOUNTS_RECEIVABLE: {
    LIST: 'accounts-receivable.list',
    VIEW: 'accounts-receivable.view',
    UPDATE: 'accounts-receivable.update',
  },
  CREDITS_RECEIVABLE: {
    LIST: 'credits-receivable.list',
    VIEW: 'credits-receivable.view',
    UPDATE: 'credits-receivable.update',
  },
  TAXES_PAYABLE: {
    LIST: 'taxes-payable.list',
    VIEW: 'taxes-payable.view',
    UPDATE: 'taxes-payable.update',
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
  },
} as const;

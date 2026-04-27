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
} as const;

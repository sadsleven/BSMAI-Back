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

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  ...usersPermissions,
  ...rolesPermissions,
  ...permissionsResourcePermissions,
];

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
} as const;

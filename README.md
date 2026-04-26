# AFMI Backend

API backend construida con [NestJS](https://nestjs.com/) y TypeORM sobre PostgreSQL. Incluye autenticación JWT, RBAC con roles y permisos, paginación, migraciones, seeding, WebSockets (Socket.IO) y tareas programadas.

## Requisitos previos

- **Node.js** (LTS recomendado)
- **PostgreSQL** accesible desde la máquina donde corre la app
- **npm** o **yarn** (el proyecto incluye `package-lock.json` y `yarn.lock`)

## Configuración del entorno

1. Copia el archivo de ejemplo y ajusta valores reales:

   ```bash
   cp .env.example .env
   ```

2. Variables principales (ver `.env.example`):

   | Variable                  | Descripción                                                       |
   | ------------------------- | ----------------------------------------------------------------- |
   | `DB_HOST`                 | Host de PostgreSQL                                                |
   | `DB_PORT`                 | Puerto                                                            |
   | `DB_USERNAME`             | Usuario de la base de datos                                       |
   | `DB_PASSWORD`             | Contraseña                                                        |
   | `DB_NAME`                 | Nombre de la base de datos                                        |
   | `DB_SSL`                  | `true` o `false`                                                  |
   | `PORT`                    | Puerto HTTP (por defecto 3000)                                    |
   | `CORS_ORIGIN`             | Orígenes permitidos (coma-separados) para HTTP y WebSocket        |
   | `JWT_SECRET`              | Secreto para firmar el JWT (cambiar en producción)                |
   | `JWT_EXPIRATION`          | Duración del token (`7d`, `12h`, `3600s`, ...)                    |
   | `SUPER_ADMIN_FIRST_NAME`  | Nombre del Super Admin que crea el seed                           |
   | `SUPER_ADMIN_LAST_NAME`   | Apellido del Super Admin                                          |
   | `SUPER_ADMIN_EMAIL`       | Email del Super Admin                                             |
   | `SUPER_ADMIN_PHONE`       | Teléfono del Super Admin (opcional)                               |
   | `SUPER_ADMIN_PASSWORD`    | Contraseña del Super Admin (cambiar después del primer login)     |

3. Instala dependencias:

   ```bash
   npm install
   ```

   > Si hay conflictos de peers (paquetes ya conviven con `--legacy-peer-deps`), repetir con
   > `npm install --legacy-peer-deps`.

4. Aplica migraciones, opcionalmente carga datos de seed, y arranca:

   ```bash
   npm run migrate
   npm run seed
   npm run dev
   ```

## Inspección de la base de datos (MCP `postgres_afmi`)

Hay un MCP configurado (`postgres_afmi`) que conecta directo a la base. Sirve para:

- Inspeccionar el esquema antes de crear migraciones (`list_tables`, `schema`).
- Validar que migraciones y seeds se aplicaron (queries SQL de comprobación).
- Verificar relaciones (tablas pivote `users_roles` y `roles_permissions`).
- Diagnosticar errores de integridad referencial.

No usar el MCP para insertar/actualizar datos que correspondan a una migración o seed; pensarlo como herramienta de inspección.

---

## Stack tecnológico

| Área              | Tecnología |
| ----------------- | ---------- |
| Framework         | NestJS 10  |
| Lenguaje          | TypeScript 5 |
| ORM / BD          | TypeORM 0.3 + PostgreSQL (`pg`) |
| Auth              | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` |
| Configuración     | `@nestjs/config`, `dotenv` |
| Validación / DTOs | `class-validator`, `class-transformer` |
| WebSockets        | `@nestjs/websockets`, `@nestjs/platform-socket.io`, Socket.IO |
| Tareas programadas| `@nestjs/schedule` |

---

## Comandos de `package.json`

| Script | Comando | Qué hace |
| ------ | ------- | -------- |
| `build` | `nest build` | Compila a `dist/`. Necesario antes de producción. |
| `dev` | `nest start --watch` | Desarrollo con recarga al guardar. |
| `start:prod` | `node dist/main` | Ejecuta el build ya compilado. |
| `migrate` | `ts-node src/runMigrations.ts` | Habilita la extensión `uuid-ossp` y corre migraciones pendientes. |
| `migration:create` | TypeORM CLI | `npm run migration:create --name=Descripcion` |
| `migration:down` | `migration:revert` | Revierte la última migración. |
| `seed` | `ts-node src/seed.ts` | Inserta permisos catálogo + rol Super Admin + usuario Super Admin. |
| `lint`, `test`, `test:cov`, `test:e2e` | -- | ESLint y Jest. |

---

## Arquitectura modular

Cada dominio vive en `src/<modulo>/` y registra su `XxxModule` en `AppModule`:

- **`auth/`** — JWT + estrategia + guards globales (`JwtAuthGuard`, `PermissionsGuard`) + endpoints `/auth/login`, `/auth/logout`, `/auth/me`.
- **`users/`** — entity `User`, CRUD completo, soft/hard delete, restore, toggle-active, change-password.
- **`roles/`** — entity `Role`, CRUD + asignación de permisos.
- **`permissions/`** — entity `Permission` solo lectura. Catálogo de permisos en `permissions.catalog.ts`.
- **`seed/`** — `SeedService.run()` idempotente: permisos → rol Super Admin → usuario Super Admin.

Para nuevos dominios, generar con `npx nest g module nombre` y agregar a `AppModule.imports`.

### Convención: módulos protegidos por permisos

```ts
// my-resource.controller.ts
@Controller('my-resource')
export class MyResourceController {
  @RequirePermissions('my-resource.list')
  @Get()
  findAll() { /* ... */ }

  @RequirePermissions('my-resource.create')
  @Post()
  create(@Body() dto: CreateDto) { /* ... */ }
}
```

- `JwtAuthGuard` está registrado globalmente: todo endpoint requiere JWT salvo que tenga `@Public()`.
- `PermissionsGuard` también es global: si el endpoint declara `@RequirePermissions(...)`, se chequean.
- Si el usuario tiene `isSuperAdmin: true`, el guard pasa siempre.
- Para endpoints sin permisos específicos pero autenticados, no añadir el decorador.

### Patrón de DTOs

- Validar con `class-validator` (`@IsEmail`, `@MinLength`, `@IsUUID('4', { each: true })`, etc.).
- DTOs de actualización heredan con `PartialType(CreateDto)` (de `@nestjs/mapped-types`).
- Para confirmaciones (`confirmPassword`, `confirmNewPassword`) usar `@Validate(MatchConstraint, ['otherProp'])`.

### Patrón de soft delete (TypeORM)

- Columna `@DeleteDateColumn() deletedAt` en la entidad.
- En servicios:
  - `repo.softDelete(id)` para borrado lógico.
  - `repo.restore(id)` para restaurar.
  - `repo.delete(id)` para hard delete.
  - Listados normales no devuelven soft-deleted; pasar `withDeleted: true` o `qb.withDeleted()` cuando haga falta.

### Cómo agregar nuevos permisos

1. Editar `src/permissions/permissions.catalog.ts` y sumar entradas a `PERMISSION_CATALOG`. Cada permiso lleva `name`, `resource`, `action`, `description` (todos en español la descripción).
2. Agregar un alias semántico en el objeto `PERMISSIONS` para usarlo desde decoradores.
3. Correr `npm run seed` — el seed sincroniza el catálogo (insert si falta, update si cambió la descripción) y reasigna todos los permisos al rol Super Admin.

### Cómo extender el seed

`src/seed/seed.service.ts` ya inyecta repositorios de `User`, `Role` y `Permission`. Para agregar nuevas seeds:

1. Registrar la entidad nueva en `seed.module.ts` (`TypeOrmModule.forFeature([...])`).
2. Inyectar el repositorio en `SeedService`.
3. Implementar la lógica idempotente en `run()` (buscar antes de insertar; comparar antes de actualizar).
4. Correr `npm run seed`.

---

## Migraciones

- **Ubicación:** `src/database/migrations/`
- **Convención UUID:** `type: 'uuid'`, `isPrimary: true`, `default: 'uuid_generate_v4()'`, `isGenerated: true`, `generationStrategy: 'uuid'`.
- **Ejecutar pendientes:** `npm run migrate` (corre `runMigrations.ts`, habilita `uuid-ossp`).
- **Revertir última:** `npm run migration:down`.
- **Crear migración nueva:** `npm run migration:create --name=Descripcion` (después editar `up`/`down`).

---

## Endpoints

### Auth

| Método | Ruta | Permisos | Descripción |
| ------ | ---- | -------- | ----------- |
| POST | `/auth/login` | público | Recibe `{ email, password }`, devuelve `{ accessToken, user }` |
| POST | `/auth/logout` | autenticado | Revoca el JWT actual (blacklist en memoria por `jti` hasta su expiración) |
| GET  | `/auth/me` | autenticado | Devuelve el usuario actual con roles y permisos resueltos |
| PATCH | `/auth/me` | autenticado (sin RBAC) | Self-service: actualiza `firstName`, `lastName`, `email`, `phoneNumber` del usuario del JWT. Ignora cualquier otro campo. |
| PATCH | `/auth/me/password` | autenticado (sin RBAC) + throttler 5/min | Self-service: cambia la contraseña propia. Requiere `currentPassword`, `newPassword`, `confirmNewPassword`. Rechaza si `newPassword === currentPassword`. |

> **Self-service vs admin RBAC**: `/auth/me*` toma el `userId` siempre del JWT (`request.user`), nunca del body o de la URL. Estos endpoints **no** requieren permisos RBAC, sólo JWT válido. Para administrar a otros usuarios usar `/users/:id`, que sí pasa por `PermissionsGuard`. Cambiar la contraseña propia se hace por `/auth/me/password`; el endpoint admin equivalente es `/users/:id/change-password`.

### Users

| Método | Ruta | Permiso |
| ------ | ---- | ------- |
| GET    | `/users` | `users.list` |
| GET    | `/users/:id` | `users.view` |
| POST   | `/users` | `users.create` |
| PATCH  | `/users/:id` | `users.update` |
| PATCH  | `/users/:id/change-password` | `users.change-password` (o ser el propio usuario) |
| PATCH  | `/users/:id/toggle-active` | `users.toggle-active` |
| DELETE | `/users/:id` | `users.soft-delete` |
| DELETE | `/users/:id/permanent` | `users.hard-delete` |
| PATCH  | `/users/:id/restore` | `users.restore` |

`GET /users` soporta `page`, `limit`, `search`, `isActive`, `isSuperAdmin`, `roleId`, `roleIds` (CSV de UUIDs para filtro multi-select), `sortBy`, `sortDir`, `withDeleted` (todos opcionales).

> Reglas de auto-edición: `PATCH /users/:id` rechaza con `403` cualquier intento del usuario logueado de cambiar su propio `isActive` o `isSuperAdmin`. `PATCH /users/:id/toggle-active` rechaza cuando `id === request.user.id`. Esto bloquea escalada/auto-bloqueo aunque la UI lo intente.

### Roles

| Método | Ruta | Permiso |
| ------ | ---- | ------- |
| GET    | `/roles` | `roles.list` |
| GET    | `/roles/assignable` | `roles.list` |
| GET    | `/roles/:id` | `roles.view` |
| POST   | `/roles` | `roles.create` |
| PATCH  | `/roles/:id` | `roles.update` |
| PATCH  | `/roles/:id/permissions` | `roles.assign-permissions` |
| PATCH  | `/roles/:id/toggle-active` | `roles.toggle-active` |
| DELETE | `/roles/:id` | `roles.soft-delete` |
| DELETE | `/roles/:id/permanent` | `roles.hard-delete` |
| PATCH  | `/roles/:id/restore` | `roles.restore` |

`GET /roles` soporta `page`, `limit`, `search`, `sortBy`, `sortDir`, `withDeleted`, `origin` (`system` | `custom` | `all`), `isActive` (`true`/`false`).

`GET /roles/assignable` devuelve un array plano (sin paginación) con los roles `isActive = true` y no eliminados, ordenados por nombre. Lo consume el selector de roles del formulario de usuario; **no debe usarse como reemplazo del listado paginado** que se sigue exponiendo en `GET /roles` para administración.

### Roles del sistema (`isSystem`)

- La entity `Role` tiene la columna `isSystem boolean default false`.
- El seed marca `isSystem = true` en el rol `Super Admin`.
- `RolesService.update`, `assignPermissions`, `softDelete`, `hardDelete` y `toggleActive` rechazan con `403 Forbidden` cualquier operación sobre un rol con `isSystem = true`.
- Migración: `1777300000000-AddRoleIsSystem.ts` agrega la columna y marca `Super Admin` como sistema.

### Habilitar/Deshabilitar roles (`isActive`)

- `Role.isActive boolean default true`. Migración `1777400100000-AddRoleIsActive.ts`.
- Endpoint `PATCH /roles/:id/toggle-active` (permiso `roles.toggle-active`). Rechaza con `403` si `isSystem = true`.
- Cuando un rol queda en `isActive = false`, **los usuarios mantienen la asignación** pero `JwtStrategy` filtra esos roles al computar permisos efectivos — así que no conceden sus permisos. Misma lógica vale si el rol está en papelera (`deletedAt != null`).

### Permissions

| Método | Ruta | Permiso |
| ------ | ---- | ------- |
| GET    | `/permissions` | `permissions.list` |

---

## Catálogo inicial de permisos

Cada permiso del catálogo (`src/permissions/permissions.catalog.ts`) tiene cinco campos: `name` (clave técnica), `resource`, `action`, `label` (título corto en español), `description` (descripción larga) y `group` (sección en español). El seed sincroniza los cinco. **El frontend nunca muestra `name` al usuario final** — usa `label` y agrupa por `group`.

Migración `1777400000000-AddPermissionI18n.ts` agrega `label` y `group` y backfilla los registros existentes.

Recurso `users` (grupo "Usuarios"):
- `users.list`, `users.view`, `users.create`, `users.update`, `users.change-password`,
  `users.toggle-active`, `users.soft-delete`, `users.hard-delete`, `users.restore`.

Recurso `roles` (grupo "Roles"):
- `roles.list`, `roles.view`, `roles.create`, `roles.update`, `roles.toggle-active`,
  `roles.assign-permissions`, `roles.soft-delete`, `roles.hard-delete`, `roles.restore`.

Recurso `permissions` (grupo "Permisos"):
- `permissions.list`.

---

## Paginación

`src/shared/utils/paginate.ts`:

- `paginate<T>(repo, page, limit, sort?, filter?, relations?, select?)` con `findAndCount`.
- `paginateBuilder<T>(qb, page, limit, customMapper?)` con un `SelectQueryBuilder`.

Ambas devuelven `PaginatedResponse<T>` (`data` + `metadata: { total, page, lastPage }`).

### Regla crítica: `take`/`skip`, no `limit`/`offset`

`paginateBuilder` usa `qb.take()` + `qb.skip()` + `getManyAndCount()`. **No usar nunca `qb.limit()`/`qb.offset()` cuando hay `leftJoinAndSelect` con relaciones a-muchos** (p. ej. `roles`, `permissions`): el JOIN crea un producto cartesiano, `LIMIT` corta filas crudas y resultado: usuarios desaparecen y a otros les "falta" un rol. Con `take/skip`, TypeORM hace dos queries internas (una con `DISTINCT` para los IDs paginados, otra para hidratar las relaciones), y `total` cuenta entidades distintas.

Reglas adicionales:
- Ordenar siempre por columnas de la entity raíz (p. ej. `user.email`); ordenar por columna de relación a-muchos es ambiguo después del agrupamiento.
- `sortBy` debe estar validado contra una **whitelist** en el DTO (`@IsIn([...])`) — previene SQL injection vía query param. Ya está en `QueryUsersDto` y `QueryRolesDto`.
- Tests: `src/shared/utils/paginate.spec.ts` cubre el caso de paginar entidades con relaciones a-muchos sin perder filas y total = entidades distintas.

---

## WebSockets

Misma configuración previa: `WebsocketGateway` (Socket.IO) con CORS desde `CORS_ORIGIN`. Inyectar `WebsocketGateway` en un servicio para llamar `emit(event, data)`.

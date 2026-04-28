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

Recurso `specialties` (grupo "Especialidades"), `patients` (grupo "Pacientes"), `doctors` (grupo "Doctores"), `care-centers` (grupo "Centros de atención"), `insurances` (grupo "Seguros"), `pathologies` (grupo "Patologías"), `service-types` (grupo "Tipos de servicio"), `branches` (grupo "Sucursales"):
- 8 acciones estándar cada uno: `<resource>.{list,view,create,update,toggle-active,soft-delete,hard-delete,restore}`. Generadas vía helper `buildResourcePermissions` en `permissions.catalog.ts`.

Recurso `orders` (grupo "Órdenes"): 7 acciones — `orders.{list,view,create,update,soft-delete,hard-delete,restore}`. **No tiene `toggle-active`** porque las órdenes no se habilitan/deshabilitan; transitan por estados. `orders.update` cubre tanto edición de la orden (sólo en `draft`) como gestión de pagos (sub-recurso `/orders/:id/payments`).

`GET /banks` es público (no requiere permiso).

---

## Módulos clínicos

### Especialidades (`specialties`)

CRUD simple. Endpoint extra `GET /specialties/assignable` (permiso `specialties.list`) devuelve sólo `isActive = true` y no eliminadas, ordenadas por nombre — para selectores en formularios. Diferente del listado paginado `GET /specialties`.

### Bancos (`banks`)

`Bank { id, code varchar(8) UNIQUE, name varchar(200) }`. Catálogo cerrado cargado desde `src/banks/banks.data.ts` por `SeedService.seedBanks()` (idempotente: insert si falta, update si nombre cambió). `GET /banks` público.

### Formatos venezolanos compartidos

`src/shared/validators/ve-formats.ts` exporta `CEDULA_PATTERN`, `RIF_PATTERN`, `PHONE_PATTERN` + mensajes canónicos + `normalizeCedula`/`normalizeRif`. **Todo DTO con cédula/RIF/teléfono importa de aquí**, no redefine regex local. El service llama `normalize*` antes de `save()` para evitar duplicados con casing distinto.

### Pacientes (`patients`)

Cédula + email + nombres + birthDate + dirección + phones (1-10) + insurances M2M (opcional) + isActive. Tabla `patient_phones` OneToMany con cascade+eager. M2M con `insurances` vía pivote `patient_insurances` (FK CASCADE). Cédula y email únicos. Standard CRUD + soft delete + toggle-active.

`insuranceIds` opcional en `CreatePatientDto` / `UpdatePatientDto`. Validación: nuevos IDs (no asignados antes) deben existir, estar `isActive=true` y `deletedAt=null` → si no, `BadRequestException` con lista de IDs inválidos. IDs ya asignados que se volvieron stale (deshabilitados / papelera) se mantienen silenciosamente para que el FE pueda mostrarlos como chips quitables. Filtro `insuranceId` en `GET /patients` usa subquery sobre `patient_insurances` (evita perder otros seguros del mismo paciente al filtrar).

### Seguros (`insurances`)

Name (único) + description + phones (1-10) + isActive. Tabla `insurance_phones` siguiendo convención **per-owner** (consistente con `patient_phones`/`doctor_phones`/`care_center_phones`). Replace-all en PATCH. M2M inversa hacia `Patient` (no eager — el patient sí lo es). Endpoint extra `GET /insurances/assignable` (permiso `insurances.list`) devuelve activos + no eliminados.

### Patologías (`pathologies`) y Tipos de servicio (`service-types`)

CRUD simple paralelo a Especialidades: name (único) + description + isActive + soft delete + toggle-active + restore + assignable.

### Órdenes (`orders`) — Paso 1 (registro)

Entity con FKs: `branchId`, `holderId`, `patientId` (ambos a `patients`, pueden coincidir), `contractorId?`, `insuranceId?`, `providerType ∈ {doctor, care_center}` con `doctorId?`/`careCenterId?` (exactamente uno según `providerType`), `specialtyId`, `serviceTypeId`, `pathologyId`, `orderDate`, `appointmentDate`, `priceCurrency`, `priceAmount`, `createdById`. Subtabla `order_payments` con FK `orderId` (CASCADE) + `exchangeRateId?` (RESTRICT, histórica).

**Sin `isActive` ni `toggle-active`**. Estados (`OrderStatus`): `draft → in_progress → attended → report_issued → finalized` + `cancelled` (terminal alterno). Map `ALLOWED_TRANSITIONS` en el service define las transiciones permitidas. Toda orden nueva nace `draft`. Edición permitida sólo si `status === 'draft'`. Los endpoints de transición de estado (`/advance`, etc.) **no están implementados aún** — sólo CRUD básico + sub-recurso pagos. `finalized` no admite cambios salvo soft delete.

`orderNumber` autogenerado vía `nextval('orders_seq')` con formato `ORD-YYYY-NNNNNN`.

**Filtrado por sucursal del usuario**: en `findAll`/`findOne`, si `user.isSuperAdmin === false`, se restringe a las sucursales asignadas al usuario (consulta directa a `user_branches` filtrada por `isActive` + no eliminadas). Super Admin ve todo. Regla análoga a la de Sucursales pero aplicada en la consulta de órdenes — **enforcement server-side de visibilidad**.

**Validaciones cruzadas** en `validateCoreReferences`:
- Doctor o centro mutuamente excluyentes según `providerType`.
- `specialtyId` debe estar entre las del proveedor (`doctor.specialties` o `careCenter.specialties`).
- Si `type === 'insurance'`: `contractorId` e `insuranceId` deben pertenecer al `holder` (`holder.contractors` y `holder.insurances`). Para otros tipos, ambos campos deben estar ausentes.
- `appointmentDate >= orderDate`.
- `branchId` debe estar en las sucursales visibles del usuario (Super Admin lo evade).

**Pagos** (`order_payments`): tipos `mobile_payment | bank_transfer | cash_foreign | cash_bs | other`. Cada tipo valida sus campos en `resolvePaymentForSave`:
- `mobile_payment`/`bank_transfer`: `bankCode` (lookup contra `banks`), `referenceNumber`, `exchangeRateId` (histórica), `amountCurrency = 'BS'`.
- `cash_bs`: `exchangeRateId`, `amountCurrency = 'BS'`.
- `cash_foreign`: `amountCurrency` debe coincidir con `priceCurrency` de la orden.
- `other`: `referenceNumber`, `amountCurrency` debe coincidir con `priceCurrency`.

**Replace-all en update**: si el body de update incluye `payments`, se borra el conjunto previo y se re-inserta. Mismo patrón que doctor/centro. Pagos sólo se admiten para órdenes `cash` y `cashea`.

Endpoints: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`, `DELETE /orders/:id/permanent`, `PATCH /orders/:id/restore`, `POST /orders/:id/payments`, `PATCH /orders/:id/payments/:paymentId`, `DELETE /orders/:id/payments/:paymentId`. Permiso `orders.update` cubre tanto el cuerpo de la orden como su sub-recurso de pagos.

### Sucursales (`branches`)

CRUD estándar paralelo a Especialidades + endpoint `GET /branches/assignable` (sólo `isActive = true` y no eliminadas). Relación M2M con `User` vía pivote `user_branches` (FK CASCADE en ambas direcciones).

Convención **Super Admin = todas las sucursales**:
- En BD: el Super Admin no tiene filas en `user_branches`. Crear/editar Super Admin con `branchIds` no vacío es ignorado en el service (se setea `branches = []`).
- En `auth/me` y los endpoints `GET /users/:id` / `GET /users`: el backend devuelve la lista efectiva — para Super Admin = todas las sucursales activas y no eliminadas; para usuario regular = sus asignadas filtradas por `isActive` y no eliminadas.
- El FE consume esa lista directamente y nunca debe replicar la regla del Super Admin.

Validación assignable mismo patrón que `insurances` / `contractors`: IDs nuevos requieren existir + `isActive=true` + `deletedAt=null`; IDs ya asignados que se volvieron stale se mantienen silenciosamente para que el FE pueda mostrarlos como chips quitables. Filtro `branchId` en `GET /users` usa subquery sobre `user_branches` y siempre incluye Super Admins (`user."isSuperAdmin" = true OR user.id IN (SELECT ...)`) — no se pierden por filtrar.

### Doctores (`doctors`) y Centros de atención (`care-centers`)

Estructura paralela:

- **Doctor**: cédula + email + nombres + `isLegalEntity` + `rif` (nullable, condicional) + specialties M2M (1+) + phones (1-10) + paymentMethods (0-20) + isActive.
- **CareCenter**: `name` + email + `rif` (NOT NULL, siempre obligatorio) + specialties M2M (1+) + phones + paymentMethods + isActive. Sin `isLegalEntity`.

Decisiones de diseño:

1. **Phones por owner**: tablas `doctor_phones`, `care_center_phones`, `patient_phones`, `insurance_phones`. Polimórfica única evaluada y descartada — relaciones TypeORM y cascadas más simples por owner. **Cualquier nuevo módulo con phones crea su propia `<owner>_phones`.**
2. **Payment methods STI**: `doctor_payment_methods` y `care_center_payment_methods`. Discriminador `type` ∈ `mobile_payment | bank_transfer | other`. Columnas tipo-específicas todas nullable. El DTO valida campo a campo con `@ValidateIf((o) => o.type === '...')`.
3. **Replace-all en PATCH**: el service borra y re-inserta phones/paymentMethods en cada update. El payload es self-contained, sin sub-recursos REST. Razón: simplifica el FE — el cliente envía siempre el array final como lo quiere.
4. **Cross-validation `isLegalEntity ↔ rif`** (sólo doctores): `@ValidateIf((o) => o.isLegalEntity === true)` en el DTO + check en service que lanza `BadRequestException` ambos sentidos (RIF requerido si jurídica; ausente si natural). Defensa en profundidad ante clientes maliciosos.
5. **Validación de `bankCode`**: `validatePaymentMethods()` en el service hace lookup contra `banks` por `code` antes de `save()`. Si el código no existe → `BadRequestException`.

Endpoints estándar: `GET /<recurso>`, `GET /<recurso>/:id`, `POST /<recurso>`, `PATCH /<recurso>/:id`, `PATCH /<recurso>/:id/toggle-active`, `DELETE /<recurso>/:id`, `DELETE /<recurso>/:id/permanent`, `PATCH /<recurso>/:id/restore`. Filtro `entityType` (`natural|legal|all`) sólo en doctores.

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

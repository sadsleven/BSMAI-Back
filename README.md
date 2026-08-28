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
   | `CORS_ORIGIN`             | Orígenes permitidos separados por coma (deben coincidir con el `Origin` del navegador: `https://…` sin `/` final). Con lista explícita se activa `credentials` (cookies / peticiones con credenciales). `*` = cualquier origen sin credenciales entre dominios. |
   | `JWT_SECRET`              | Secreto para firmar el JWT (cambiar en producción)                |
   | `JWT_EXPIRATION`          | Duración del token (`7d`, `12h`, `3600s`, ...)                    |
   | `SUPER_ADMIN_FIRST_NAME`  | Nombre del Super Admin que crea el seed                           |
   | `SUPER_ADMIN_LAST_NAME`   | Apellido del Super Admin                                          |
   | `SUPER_ADMIN_EMAIL`       | Email del Super Admin                                             |
   | `SUPER_ADMIN_PHONE`       | Teléfono del Super Admin (opcional)                               |
   | `SUPER_ADMIN_PASSWORD`    | Contraseña del Super Admin (cambiar después del primer login)     |
   | `ORDER_NUMBER_START`      | Opcional. Número desde el cual arranca la secuencia auto-incremental `orders_seq`. Sólo aplica si la secuencia actual está por debajo (idempotente, nunca retrocede). Útil para empezar producción en, p. ej., `5500`. Default `1`. |

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

## Despliegue en Vercel

Vercel detecta Nest por `src/main.ts` y expone la app como una sola función ([documentación oficial](https://vercel.com/docs/frameworks/backend/nestjs)). **No hace falta `vercel.json`** ni `export default` del adaptador HTTP.

1. **Build Command:** usa sólo compilación (y migraciones si quieres, con base de datos accesible desde el build). Ejemplos válidos:
   - `npm run build`
   - `npm run build && npm run migrate` (sólo si `DB_*` / SSL están bien configurados en el entorno de build y la red lo permite).

   **No** incluyas `npm run start` ni `nest start` en el build: son procesos largos que no terminan; el despliegue puede quedar mal o sin rutas útiles, y verás **404 NOT_FOUND** al abrir la URL.

2. **Install Command:** `npm install` (o el que uses en local).

3. **Output Directory:** déjalo **vacío**. Si lo pones en `dist`, Vercel trata el proyecto como sitio estático y las peticiones no llegan a Nest.

4. **Root Directory:** si el repo incluye front y back, apunta el proyecto de Vercel al directorio del backend (por ejemplo `afmi-backend`).

5. Variables de entorno (`DB_*`, `JWT_*`, `CORS_ORIGIN` con **todas** las URLs del front que usen la API: producción, local y, si aplica, previews `*.vercel.app`, separadas por coma, etc.) en el panel de Vercel para *Production* y *Preview*.

6. Tras desplegar, prueba un endpoint que exija JWT (por ejemplo `GET /auth/me` sin header `Authorization`): deberías obtener **401** con cuerpo JSON de Nest, no el 404 genérico de Vercel.

7. Si usas **`vercel.json`** con `routes` y filtro **`methods`**, incluye siempre **`OPTIONS`** (y conviene **`HEAD`**). Si no, el **preflight CORS** del navegador no llega a Nest y verás errores del tipo «No 'Access-Control-Allow-Origin' header» aunque `enableCors` esté bien. Lo más seguro es **no limitar `methods`** en la ruta catch-all (como en el `vercel.json` del repo).

> **WebSockets / Socket.IO:** en funciones serverless el modelo es distinto al de un servidor Node largo; revisa límites de tiempo y conexión si dependes del gateway en tiempo real.

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

Cédula + email **opcional** + nombres + birthDate + dirección + phones **opcional** (0-10) + contractors M2M (opcional) + isActive. Tabla `patient_phones` OneToMany con cascade+eager. Cédula única (parcial), email único parcial (`WHERE email IS NOT NULL`). Standard CRUD + soft delete + toggle-active.

**El paciente NO tiene `insurances` directos**. Los seguros visibles del paciente se derivan de los contratistas asignados (M2M `patient_contractors` ⨝ `contractor_insurances`). Migración `1782002400000-MoveInsuranceToContractor.ts` elimina la tabla `patient_insurances` (backfilla a `contractor_insurances` antes de drop).

`contractorIds` opcional en `CreatePatientDto` / `UpdatePatientDto`. Validación: nuevos IDs deben existir, estar `isActive=true` y `deletedAt=null`. IDs ya asignados stale se mantienen silenciosamente. Filtro `insuranceId` en `GET /patients` cruza `patient_contractors` con `contractor_insurances`.

### Seguros (`insurances`)

Name (único) + description + email **opcional** + `fiscalAddress` (varchar 500, opcional) + phones (0-10) + isActive. Tabla `insurance_phones` per-owner. Email parcial unique. Replace-all en PATCH. **M2M inversa hacia `Contractor`** (`contractors` collection — no Patient). Endpoint extra `GET /insurances/assignable` devuelve activos + no eliminados.

### Contratistas (`contractors`)

Name (único) + description + isActive **+ insurances M2M** vía pivote `contractor_insurances` (FK CASCADE en ambas direcciones, eager en Contractor). Endpoint `GET /contractors/assignable` carga `insurances` eager (lo necesita el OrderForm para derivar los seguros visibles del holder según contratista). Replace-all en update.

### Doctores y Centros — campos opcionales

- **Doctor**: email **opcional** (parcial unique). `cedula` sigue obligatoria. Si `isLegalEntity = true`, `rif` es requerido (validación cruzada). Phones opcionales.
- **CareCenter**: email **opcional** y RIF **opcional** (ambos parcial unique). Sin `isLegalEntity`. Phones opcionales.

Migraciones: `1782001900000-MakePatientDoctorEmailOptional`, `1782002000000-AddInsuranceEmailAndCareCenterOptional`, `1782002100000-AddInsuranceFiscalAddress`.

### Tipos de servicio (`service-types`) y precios

CRUD simple (name + description + isActive) **+ precios por seguro y "Particular"**.

- Tabla `service_type_prices(id, serviceTypeId FK, insuranceId FK nullable, priceUsd numeric(14,2), priceEur numeric(14,2))`. Migración `1782002200000-CreateServiceTypePrices.ts`.
- Dos índices unique parciales: una fila por `(serviceTypeId, insuranceId)` cuando `insuranceId IS NOT NULL`, y una sola fila Particular por `serviceTypeId` cuando `insuranceId IS NULL`.
- DTO `ServiceTypePriceDto` (`insuranceId?`, `priceUsd?`, `priceEur?`). En `CreateServiceTypeDto` / `UpdateServiceTypeDto` el array `prices` es opcional.
- `ServiceTypesService` valida que los `insuranceId` referenciados existan y no estén borrados; normaliza filas (filtra las que no traen ni USD ni EUR; rechaza duplicados); replace-all en update (delete por `serviceTypeId` + insert).
- `findAssignable()` carga `prices` eager para que el FE de órdenes calcule sumas en cliente.

### Patologías (`pathologies`) y Tipos de servicio (`service-types`)

CRUD simple paralelo a Especialidades: name (único) + description + isActive + soft delete + toggle-active + restore + assignable.

### Órdenes (`orders`) — Paso 1 (registro)

Entity con FKs: `branchId`, `holderId`, `patientId` (ambos a `patients`, pueden coincidir), `contractorId?`, `insuranceId?`, `providerType ∈ {doctor, care_center}` con `doctorId?`/`careCenterId?` (exactamente uno según `providerType`), `specialtyId` (principal derivada — la especialidad real vive por fila en `order_service_types`), `orderDate`, `appointmentDate`, `priceCurrency`, `priceAmount`, `createdById`. **`serviceTypes` y `pathologies` son M2M** (no FKs escalares).

- Pivot `order_service_types(orderId, serviceTypeId)` — **N tipos de servicio (≥1)**. FK orderId CASCADE, serviceTypeId RESTRICT.
- Pivot `order_pathologies(orderId, pathologyId)` — **0..N patologías**. Mismo esquema FK.
- Migración `1782002300000-OrderServiceTypesPathologiesM2M.ts` crea las pivotes, backfilla desde las columnas escalares pre-existentes y las dropea.

Subtabla `order_payments` con FK `orderId` (CASCADE) + `exchangeRateId?` (RESTRICT, histórica).

**Sin `isActive` ni `toggle-active`**. Estados (`OrderStatus`): `draft → in_progress → attended → report_issued → finalized` + `cancelled` (terminal alterno). Toda orden nueva nace `draft`. Edición permitida sólo si `status === 'draft'`.

**`orderNumber`** es número auto-incremental simple (string sólo dígitos) desde `nextval('orders_seq')`. Ya no usa el formato `ORD-YYYY-NNNNNN`. La env `ORDER_NUMBER_START` define desde qué número arranca la secuencia: `OrdersService.onModuleInit` lee la env y, si la próxima emisión está por debajo de `START`, hace `setval('orders_seq', START - 1, true)`. Idempotente — nunca retrocede.

Las órdenes **históricas** (las que ya existían en papel y se registran ahora) se numeran a mano: el Paso 1 acepta `customOrderNumber` (entero ≥ 1, **menor** a `ORDER_NUMBER_START` y libre) con el permiso `orders.custom-number`. Ese rango el sistema nunca lo asigna solo, así que las dos numeraciones no chocan. Si la orden tiene varios proveedores, el número dado es el BASE y el resto toma los siguientes libres por debajo del piso. Mientras la orden siga en borrador se puede corregir con `PATCH /orders/:id` (renumera la orden completa). `GET /orders/config/number-start` devuelve el piso.

**Filtrado por sucursal del usuario**: en `findAll`/`findOne`, si `user.isSuperAdmin === false`, se restringe a las sucursales asignadas al usuario. Super Admin ve todo.

**Validaciones cruzadas** en `validateCoreReferences`:
- Doctor o centro mutuamente excluyentes según `providerType`.
- **Especialidad por fila ST** (`order_service_types.specialtyId`, NOT NULL, FK RESTRICT): una orden puede combinar especialidades (ej. laboratorio en un centro + rayos X en otro) y cada orden interna del Paso 2 imprime la de sus propias filas. Cada especialidad debe existir, estar activa, y **el proveedor de esa fila debe tenerla asignada** (`doctor.specialties` / `careCenter.specialties`). Excepción: los pares proveedor↔especialidad **ya persistidos** en la orden no se revalidan al editar (las órdenes previas a la migración `1782009300000` heredaron la especialidad única sin ese chequeo). `orders.specialtyId` queda como especialidad **principal derivada** = la de la primera fila (la usan el filtro del listado —vía `EXISTS` sobre todas las filas—, el dashboard y los reportes); ya **no** se envía en el DTO.
- `serviceTypeIds` (≥1) — todos deben existir, no estar borrados y `isActive=true`.
- `pathologyIds` (0..N) — si vienen, validados igual que service types.
- Si `type === 'insurance'`: `contractorId` e `insuranceId` requeridos. `contractorId` debe estar entre `holder.contractors`. **`insuranceId` debe pertenecer al contractor seleccionado** (`contractor.insurances`), no a los seguros del holder directamente. Para otros tipos, ambos campos deben estar ausentes.
- `appointmentDate >= orderDate`.
- `branchId` debe estar en las sucursales visibles del usuario (Super Admin lo evade).

Replace-all M2M en update vía `mgr.createQueryBuilder().relation(Order, 'serviceTypes').of(id).remove(...)/add(...)` (idem para `pathologies`).

**Pagos** (`order_payments`): tipos `mobile_payment | bank_transfer | cash_foreign | cash_bs | other`. Cada tipo valida sus campos en `resolvePaymentForSave`:
- `mobile_payment`/`bank_transfer`: `bankCode` (lookup contra `banks`), `referenceNumber`, `exchangeRateId` (histórica), `amountCurrency = 'BS'`.
- `cash_bs`: `exchangeRateId`, `amountCurrency = 'BS'`.
- `cash_foreign`: `amountCurrency` debe coincidir con `priceCurrency` de la orden.
- `other`: `referenceNumber`, `amountCurrency` debe coincidir con `priceCurrency`.

**Replace-all en update**: si el body de update incluye `payments`, se borra el conjunto previo y se re-inserta. Mismo patrón que doctor/centro. Pagos sólo se admiten para órdenes `cash` y `cashea`.

Endpoints: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`, `DELETE /orders/:id/permanent`, `PATCH /orders/:id/restore`, `POST /orders/:id/payments`, `PATCH /orders/:id/payments/:paymentId`, `DELETE /orders/:id/payments/:paymentId`. Permiso `orders.update` cubre tanto el cuerpo de la orden como su sub-recurso de pagos.

### Órdenes — Pasos 2-4 (implementado, file storage Paso 3 TBD)

Tras `Creación de orden` (Paso 1, ya implementado), restan 3 etapas. Naming canónico UI: **Atención del paciente / Informe médico y estudios / Facturación y liquidación**.

| # | Etapa | Estado destino | Columnas / acciones nuevas |
| - | ----- | -------------- | -------------------------- |
| 2 | Atención del paciente | `in_progress → attended` | `attended boolean default false`, `attendedAt timestamptz null` |
| 3 | Informe médico y estudios | `attended → report_issued` | dropzone multi-file (PDF/img) — **FE-only en MVP, BE storage TBD** + `otherStudies text null` |
| 4 | Facturación y liquidación | `report_issued → finalized` | `doctorAmount numeric(14,2) null`, `doctorAmountCurrency varchar(3) null` (`USD|EUR|BS`), `billingExchangeRateId uuid null` (FK `exchange_rates` RESTRICT, capturada al entrar a facturación) |

**Cap doctor amount**: `doctorAmount` convertido a `priceCurrency` (Bs ↔ USD/EUR vía `billingExchangeRateId`) debe ser ≤ `priceAmount`. Validado en `OrdersService.transitionToBilling` / `update` cuando estado ≥ `report_issued`.

**Tax doctor**: solo si `providerType === 'doctor'`. `taxRate = doctor.isLegalEntity ? 0.05 : 0.03`. Calculado al vuelo, **no se persiste** (`doctor.isLegalEntity` puede cambiar pero la cuenta congela `doctorAmount` y `billingExchangeRateId`). Mostrado en moneda original + Bs vía `billingExchangeRateId`.

**Net profit empresa** = `priceAmount - doctorAmount` en `priceCurrency`. Tax NO se resta del net — es retención al doctor.

**"Orden interna" por ST** = artefacto imprimible / línea de factura por ST. **No entidad nueva** — derivado de `order_service_types`. Atención, Informe, `doctorAmount` viven a nivel de la orden completa.

**Botón "Descargar factura"** — endpoint `GET /orders/:id/invoice.pdf` (gen PDF lib TBD).

Endpoints planned (extender `OrdersController`):
- `PATCH /orders/:id/attend` — body `{ attended, attendedAt }`. Transición `in_progress → attended`. Permiso `orders.update`.
- `PATCH /orders/:id/report` — body `{ otherStudies?, files? }` (files MVP no-op en BE). Transición `attended → report_issued`.
- `PATCH /orders/:id/billing` — body `{ doctorAmount, doctorAmountCurrency, billingExchangeRateId }`. Transición `report_issued → finalized`. Validación cap + congela tasa.

### Cuentas por pagar (`accounts-payable`) — implementado

Módulo auto-generado al crear orden. Permisos: `accounts-payable.{list, view, update}` — **excepción a `buildResource`** (sin `create | toggle-active | soft-delete | hard-delete | restore`). Catálogo lo declara explícito.

- Entity `AccountsPayable { id uuid PK, orderId uuid FK orders CASCADE UNIQUE, recipientType ∈ {doctor, care_center}, doctorId uuid? FK doctors RESTRICT, careCenterId uuid? FK care_centers RESTRICT, status ∈ {paid, unpaid} default unpaid, paidAt timestamptz?, createdAt, updatedAt, deletedAt }`. Migración: índices `(status)`, `(doctorId)`, `(careCenterId)`, UNIQUE `(orderId)`.
- Subtabla `accounts_payable_payments` (esquema espejado de `order_payments`: tipos `mobile_payment | bank_transfer | cash_foreign | cash_bs | other`, `bankCode`, `referenceNumber`, `amount numeric(14,2)`, `amountCurrency`, `exchangeRateId? FK exchange_rates RESTRICT`).
- Pivot `accounts_payable_payment_links(payableId uuid, paymentId uuid, PK (payableId, paymentId))` — **N:N** pago↔cuenta. Un pago puede saldar varias cuentas (suma de assigned amounts); una cuenta puede recibir varios pagos.
- **Acción "Registrar pago"** (`POST /accounts-payable/register-payment`): body `{ payableIds: string[] (≥1), payments: PaymentDto[] (≥1) }`. Constraints validados:
  - Cuentas seleccionadas comparten `doctorId` (todas) o `careCenterId` (todas) — rechazo si mezclan.
  - Estado todas `unpaid` — re-pago de cuenta `paid` rechaza.
  - `Σ pagos = Σ amountToReceive(cuenta)` en moneda común. Bs convertido vía `billingExchangeRateId` de la **orden de origen de cada cuenta** (cada cuenta puede tener tasa distinta).
  - Tras éxito: marca todas las cuentas `paid`, `paidAt = now()`.
- **`amountToReceive(cuenta)`**:
  - recipient = doctor: `order.doctorAmount × (1 - taxRate)` (empresa retiene tax).
  - recipient = careCenter: `order.doctorAmount` (sin retención).
- Endpoints planned: `GET /accounts-payable` (paginado, filtros `status` / `doctorId` / `careCenterId` / `branchId` / `search` por `orderNumber`), `GET /accounts-payable/:id`, `PATCH /accounts-payable/:id` (editar pagos asociados; replace-all subtabla), `POST /accounts-payable/register-payment`.

### Cuentas por cobrar (`accounts-receivable`) — implementado

Mismo patrón que payable, generado **solo si `order.type === 'insurance'`**. Permisos: `accounts-receivable.{list, view, update}` — misma excepción a `buildResource`.

- Entity `AccountsReceivable { id uuid, orderId uuid FK orders CASCADE UNIQUE, insuranceId uuid FK insurances RESTRICT, status ∈ {collected, uncollected} default uncollected, collectedAt timestamptz?, createdAt, updatedAt, deletedAt }`.
- Subtabla `accounts_receivable_payments` (esquema espejado).
- Pivot `accounts_receivable_payment_links(receivableId, paymentId, PK)`.
- **Agrupación**: cuentas comparten `insuranceId`.
- **Sin cap de monto** — seguro paga por encima del agregado de órdenes. Endpoint **no bloquea** cuando `Σ pagos > Σ priceAmount`. UI muestra diferencia.
- Endpoints planned: `GET /accounts-receivable`, `GET /accounts-receivable/:id`, `PATCH /accounts-receivable/:id`, `POST /accounts-receivable/register-collection`.

### Auto-generación de cuentas

`OrdersService.create` (post-insert, mismo transactional context):
- Insert 1 `accounts_payable` (recipient derivado de `providerType` + `doctorId`/`careCenterId`).
- Si `order.type === 'insurance'`: insert 1 `accounts_receivable` con `insuranceId` de la orden.

Idempotente vía UNIQUE en `orderId`. **Tipo de orden inmutable post-`draft`** (no flow cash↔insurance) → no se reconcilia. Borrado de orden (`softDelete`/`delete`) cascada a las cuentas vía FK CASCADE.

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

Misma configuración: `WebsocketGateway` (Socket.IO) usa la misma lógica que HTTP vía `getCorsOriginConfig()` en `cors-origins.util.ts`. Inyectar `WebsocketGateway` en un servicio para llamar `emit(event, data)`.

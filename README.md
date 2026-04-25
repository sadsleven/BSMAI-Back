# AFMI Backend

API backend construida con [NestJS](https://nestjs.com/) y TypeORM sobre PostgreSQL. Incluye utilidades para paginación, migraciones, seeding, WebSockets (Socket.IO) y tareas programadas.

## Requisitos previos

- **Node.js** (LTS recomendado)
- **PostgreSQL** accesible desde la máquina donde corre la app
- **npm** o **yarn** (el proyecto incluye `package-lock.json` y `yarn.lock`)

## Configuración del entorno

1. Copia el archivo de ejemplo y ajusta valores reales:

   ```bash
   # Git Bash / macOS / Linux
   cp .env.example .env
   ```

   En **PowerShell** (Windows):

   ```powershell
   Copy-Item .env.example .env
   ```

2. Variables principales (ver `.env.example`):

   | Variable       | Descripción                          |
   | -------------- | ------------------------------------ |
   | `DB_HOST`      | Host de PostgreSQL                   |
   | `DB_PORT`      | Puerto (por defecto 5432)            |
   | `DB_USERNAME`  | Usuario de la base de datos          |
   | `DB_PASSWORD`  | Contraseña                           |
   | `DB_NAME`      | Nombre de la base de datos           |
   | `DB_SSL`       | `true` o `false` según el servidor    |
   | `CORS_ORIGIN`  | Orígenes permitidos (coma-separados) para HTTP y WebSocket |

3. Instala dependencias:

   ```bash
   npm install
   ```

4. Ejecuta las migraciones antes de levantar la app en un entorno nuevo (ver [Migraciones](#migraciones-con-typeorm)).

---

## Stack tecnológico

| Área              | Tecnología |
| ----------------- | ---------- |
| Framework         | NestJS 10  |
| Lenguaje          | TypeScript 5 |
| ORM / BD          | TypeORM 0.3 + PostgreSQL (`pg`) |
| Configuración     | `@nestjs/config`, `dotenv` |
| Validación / DTOs | `class-validator`, `class-transformer` |
| WebSockets        | `@nestjs/websockets`, `@nestjs/platform-socket.io`, Socket.IO |
| Tareas programadas| `@nestjs/schedule` |
| Utilidades        | `dayjs`, `uuid`, `axios`, `exceljs`, `puppeteer` |

Herramientas de desarrollo: ESLint, Prettier, Jest, `ts-node`, Nest CLI.

---

## Comandos de `package.json`

Todos los scripts se ejecutan con `npm run <script>` (salvo los que son binarios directos como `nest` si lo tienes global).

| Script | Comando subyacente | Qué hace |
| ------ | ------------------ | -------- |
| **`build`** | `nest build` | Compila el proyecto a `dist/`. Necesario antes de producción. |
| **`format`** | Prettier | Formatea `src/**/*.ts` y `test/**/*.ts`. |
| **`start`** | `nest start` | Arranca la app una vez (sin recarga). |
| **`dev`** | `nest start --watch` | **Desarrollo:** arranca con recarga al guardar cambios. |
| **`start:debug`** | `nest start --debug --watch` | Igual que watch pero con inspector de Node para depurar (puerto 9229 por defecto). |
| **`start:prod`** | `node dist/main` | Ejecuta el build ya compilado. Usar después de `npm run build`. |
| **`lint`** | ESLint `--fix` | Analiza y corrige lo posible en `src`, `apps`, `libs`, `test`. |
| **`test`** | Jest | Tests unitarios (archivos `*.spec.ts` bajo `src/`). |
| **`test:watch`** | Jest en modo watch | Re-ejecuta tests al cambiar código. |
| **`test:cov`** | Jest con cobertura | Genera informe en `coverage/`. |
| **`test:debug`** | Jest + inspector | Depuración de tests en banda única. |
| **`test:e2e`** | Jest con `test/jest-e2e.json` | Tests end-to-end. |
| **`migration:create`** | TypeORM CLI + `cross-var` | Crea un archivo de migración vacío en `src/database/migrations/`. Ver abajo. |
| **`migrate`** | `ts-node src/runMigrations.ts` | Inicializa la conexión, asegura extensión UUID y **ejecuta migraciones pendientes**. |
| **`migration:down`** | TypeORM `migration:revert` | **Revierte la última** migración aplicada (usa `src/shared/utils/datasource.ts`). |
| **`seed`** | `ts-node src/seed.ts` | Arranca Nest, obtiene `SeedService` y ejecuta `run()`; luego cierra la app. |

### Crear un archivo de migración (nombre del archivo)

Con **npm**, el nombre se pasa como configuración del script:

```bash
npm run migration:create --name=NombreDescriptivo
```

Esto genera algo como `src/database/migrations/<timestamp>-NombreDescriptivo.ts`. Edita el archivo y sigue el patrón de la migración de ejemplo (UUID, `up` / `down`).

---

## Arquitectura modular en NestJS

Nest organiza la app en **módulos** (`@Module`), cada uno declara `imports`, `controllers`, `providers` y `exports`. Los módulos de dominio deben **importarse** en `AppModule` (u otro módulo padre) para quedar registrados.

### CLI de Nest: generar piezas de un módulo

Desde la raíz del proyecto (con `@nestjs/cli` en `devDependencies` puedes usar `npx`):

```bash
# Módulo completo (carpeta + .module.ts)
npx nest g module nombre-modulo

# Recursos típicos dentro del módulo
npx nest g controller nombre-modulo
npx nest g service nombre-modulo
npx nest g resource nombre-modulo   # CRUD + DTOs (elige transporte cuando pregunte)
```

Convención: colocar cada dominio bajo `src/<nombre>/` (`users`, `orders`, etc.) y registrar el `XxxModule` en `app.module.ts` dentro de `imports`.

---

## Seeders (`src/seed`)

La app **no** usa un CLI de seed aparte: el flujo oficial es el programado en este repo.

1. **`src/seed.ts`** — Crea la aplicación Nest, resuelve `SeedService` y llama a `run()`, luego cierra.
2. **`src/seed/seed.module.ts`** — Módulo del seed: aquí debes registrar entidades con `TypeOrmModule.forFeature([...])` si vas a usar repositorios en el seed.
3. **`src/seed/seed.service.ts`** — Implementa la lógica en `run()` (inserts idempotentes, datos iniciales, etc.).

Ejecución:

```bash
npm run seed
```

Asegúrate de que `.env` apunte a la base correcta y de que las tablas existan (migraciones aplicadas) antes de sembrar datos que dependan del esquema.

---

## Migraciones con TypeORM

- **Ubicación:** `src/database/migrations/`
- **Ejecución:** `npm run migrate` (usa `runMigrations.ts`, habilita la extensión **`uuid-ossp`** en PostgreSQL y corre migraciones pendientes).
- **Revertir última:** `npm run migration:down`
- **DataSource CLI (revert):** `src/shared/utils/datasource.ts` — misma configuración que las migraciones; entidades en `**/*.entity{.ts,.js}`.

### Convención de código (IDs UUID)

Sigue la estructura del ejemplo `src/database/migrations/1729452544925-Example.ts`:

- Clase exportada con nombre coherente con el timestamp (p. ej. `Example1729452544925`).
- `up`: crea tablas/columnas con `QueryRunner` y `Table` de TypeORM.
- `down`: revierte de forma simétrica (p. ej. `dropTable`).
- Para claves primarias UUID, alineado con la extensión `uuid-ossp` que inicializa el proyecto:

  - `type: 'uuid'`, `isPrimary: true`
  - `default: 'uuid_generate_v4()'`, `isGenerated: true`, `generationStrategy: 'uuid'`

Así las migraciones coinciden con el estilo del ejemplo y con la extensión creada al migrar.

---

## Paginación (`src/shared/utils/paginate.ts`)

Para listados paginados, **reutiliza** estas funciones en lugar de reimplementar `skip`/`take`:

1. **`paginate<T>(repository, page, limit, sort?, filter?, relations?, select?)`**  
   Usa `findAndCount` del repositorio de TypeORM y devuelve `PaginatedResponse<T>` (`data` + `metadata`: `total`, `page`, `lastPage`).

2. **`paginateBuilder<T>(queryBuilder, page, limit, customMapper?)`**  
   Para consultas con `QueryBuilder`: cuenta el total, aplica `offset`/`limit` y opcionalmente mapea `entities` + `raw`.

La forma de la respuesta está tipada en `src/shared/interfaces/PaginatedResponse.ts`.

---

## WebSockets (`src/websocket`)

Ya existe un módulo listo para ampliar:

- **`websocket.module.ts`** — Declara y exporta el gateway para poder inyectarlo en otros servicios.
- **`websocket.gateway.ts`** — Gateway Socket.IO con CORS desde `CORS_ORIGIN`, logs de conexión/desconexión y método **`emit(event, data)`** para broadcast a todos los clientes.

`AppModule` ya importa `WebsocketModule`. Para emitir desde un servicio:

1. Importa `WebsocketModule` en el módulo que declare ese servicio (si no comparte el mismo contexto de importación).
2. Inyecta `WebsocketGateway` en el constructor del servicio y llama a `emit('nombreEvento', payload)`.

Ajusta handlers (`@SubscribeMessage`, rooms, etc.) en el gateway según necesites.

---

## Flujo de trabajo recomendado

1. Configurar `.env` y `npm install`
2. `npm run migration:create --name=Descripcion` → editar migración al estilo del ejemplo UUID
3. `npm run migrate`
4. Opcional: `npm run seed`
5. Desarrollo: `npm run dev`
6. Producción: `npm run build` y `npm run start:prod`

---

## Recursos externos

- [Documentación NestJS](https://docs.nestjs.com)
- [TypeORM migrations](https://typeorm.io/migrations)

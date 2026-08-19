# Despliegue con Docker (servidor Linux)

Stack: `api` (NestJS) + `minio` (archivos) + `minio-init` (crea el bucket).
**PostgreSQL no va en Docker**: corre instalado en el host Ubuntu.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `Dockerfile` | Imagen multi-etapa de producción (Node 22, sólo `dist` + deps de prod). |
| `docker-compose.yml` | Servicios `api`, `minio`, `minio-init` y el volumen `minio_data`. |
| `Makefile` | Atajos: `make up`, `make migrate`, `make deploy`, etc. |
| `.env.example` | Plantilla única de variables (dev y producción; los valores que cambian están anotados `[DOCKER]` / `[DEV]`). |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.env`, tests del contexto de build. |

## Requisitos en el servidor

- Docker Engine ≥ 20.10 y el plugin `docker compose` (v2).
- `make`, `git`.
- PostgreSQL escuchando en el host y accesible desde la red de Docker.

## 1. Preparar PostgreSQL en el host

El contenedor **no puede usar `localhost`** (eso es el contenedor mismo). Compose
mapea `host.docker.internal` a la IP del gateway del host, así que Postgres debe
aceptar conexiones desde la subred de Docker.

`/etc/postgresql/16/main/postgresql.conf`:

```conf
listen_addresses = '*'          # o la IP de docker0, p. ej. '172.17.0.1'
```

`/etc/postgresql/16/main/pg_hba.conf`:

```conf
# Rango por defecto de las redes bridge de Docker
host    afmi    afmi    172.16.0.0/12    scram-sha-256
```

Recarga y verifica:

```bash
sudo systemctl restart postgresql
sudo ss -lntp | grep 5432
```

Cierra el puerto al exterior en el firewall (sólo Docker debe entrar):

```bash
sudo ufw allow in on docker0 to any port 5432 proto tcp
sudo ufw deny 5432/tcp
```

Crea la base y el usuario:

```bash
sudo -u postgres psql -c "CREATE USER afmi WITH PASSWORD 'tu-clave';"
sudo -u postgres psql -c "CREATE DATABASE afmi OWNER afmi;"
```

La extensión `uuid-ossp` la crea el runner de migraciones (`initializeDatabase()`),
pero necesita permisos: si falla, córrela como superusuario una vez:

```bash
sudo -u postgres psql -d afmi -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

## 2. Primer despliegue

```bash
cd afmi-backend
make env          # copia .env.example → .env
nano .env         # edita DB_*, JWT_SECRET, CORS_ORIGIN, MINIO_*, SUPER_ADMIN_*
make build
make up
make migrate      # migraciones TypeORM
make seed         # permisos, roles, super admin, bancos (idempotente)
make ps
```

La API queda en `127.0.0.1:3000`. Publícala con nginx/caddy en el host (TLS ahí).

Ejemplo mínimo de nginx (incluye WebSocket para Socket.IO):

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`CORS_ORIGIN` debe llevar el origen exacto del front (esquema + host + puerto,
sin barra final), separado por comas si hay varios.

## 3. Actualizaciones

```bash
make deploy       # git pull + build + up + migrate
make logs-api     # seguir logs
```

## MinIO

- API S3 en `127.0.0.1:9000`, consola web en `127.0.0.1:9001` (ambas sólo por
  loopback). Para entrar a la consola sin exponerla: túnel SSH
  `ssh -L 9001:127.0.0.1:9001 usuario@servidor` → `http://localhost:9001`.
- `minio-init` crea el bucket `MINIO_BUCKET` con versionado y lo deja **privado**:
  los adjuntos son informes médicos, el acceso va con URLs firmadas, nunca con
  política anónima de lectura.
- Datos en el volumen `minio_data`. Respáldalo junto con el dump de Postgres.
  `make nuke` lo borra (pide confirmación escrita).
- Buena práctica: crear un *service account* (Access Keys en la consola) para el
  backend en vez de usar las credenciales root, y poner esas keys en `.env`.

### Storage: estado del código

`FilesModule` sigue enlazado a `VercelBlobProvider`
(`src/files/files.module.ts`), así que **MinIO queda levantado pero todavía no lo
usa el backend**. Para migrar, según el comentario que ya está en ese módulo:

1. Crear `MinioStorageProvider implements StorageProvider` (S3 API, path-style,
   URLs firmadas), consumiendo `MINIO_ENDPOINT` / `MINIO_PUBLIC_ENDPOINT` /
   `MINIO_BUCKET` / credenciales.
2. Cambiar `useClass: VercelBlobProvider` → `useClass: MinioStorageProvider`.
3. Ajustar `afmi-front/src/modules/files/infrastructure/filesGateway.ts` al
   flujo de subida por URL firmada.

Hasta entonces `BLOB_READ_WRITE_TOKEN` debe seguir seteado.

## Cron de tasas del BCV

`BcvRatesSyncService` (`src/exchange-rates/bcv/`) lee
[bcv.org.ve](https://www.bcv.org.ve/) y crea las filas de `exchange_rates` para
USD y EUR.

- **Cuándo corre**: lunes a viernes, cada 15 min de 3:00 pm a 7:45 pm hora de
  Venezuela (`America/Caracas`), más una corrida de recuperación a las 8:00 am
  por si el servidor estuvo caído la tarde anterior.
- **Fecha efectiva**: se toma de la `Fecha Valor` que publica el BCV, no del
  momento en que corre el cron. El BCV publica la tasa del **próximo día hábil**
  (el viernes por la tarde publica la del lunes), así que la fila queda con la
  fecha correcta sola.
- **Se detiene solo**: en cuanto obtiene una `Fecha Valor` posterior a hoy, no
  vuelve a consultar el resto del día. Tras un reinicio revisa la BD antes de
  salir a internet.
- **Nunca sobreescribe**: si el monto de ese día ya está guardado, no hace nada;
  si cambió, inserta una fila nueva (el histórico de `exchange_rates` es
  inmutable).
- **Serverless**: en Vercel/Lambda el cron **no se registra** (no hay proceso de
  larga vida y las instancias se duplicarían). En Docker sí corre. La detección
  está en `src/shared/utils/runtime.util.ts` (`VERCEL` /
  `AWS_LAMBDA_FUNCTION_NAME`), la misma que usa `main.ts`.

Correr a mano (funciona en los dos entornos, incluido Vercel):

```bash
make bcv-sync                                    # en el servidor, dentro del contenedor
npm run sync:bcv                                 # en local
curl -X POST -H "Authorization: Bearer <token>" \
  https://api.tudominio.com/exchange-rates/sync-bcv   # permiso exchange-rates.create
```

Variables: `BCV_CRON_ENABLED`, `BCV_SYNC_ON_BOOT`, `BCV_URL`,
`BCV_HTTP_TIMEOUT_MS`, `BCV_TLS_INSECURE` (ver `.env.example`).

Dos detalles del BCV que hay que saber:

- Su certificado TLS tiene la cadena incompleta y Node rechaza la conexión
  (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Por eso `BCV_TLS_INSECURE=true` por
  defecto: se acepta el TLS sin verificar **sólo para ese host**, en una lectura
  pública donde no se envían credenciales. Si arreglan el certificado, ponlo en
  `false`.
- Publica 8 decimales (`772,54410000`) pero `exchange_rates.amountBs` es
  `numeric(14,2)` → se redondea a `772.54`, igual que la carga manual.

## Comandos

```bash
make help          # lista todo
make up / down / restart / stop / ps
make logs / logs-api / logs-minio
make sh            # shell en el contenedor de la API
make migrate       # node dist/runMigrations.js
make seed          # node dist/seed.js
make bcv-sync      # fuerza la sincronización de tasas con el BCV
make rebuild       # build --no-cache + up
make deploy        # pull + build + up + migrate
make clean         # down --remove-orphans + prune de imágenes
make nuke          # PELIGRO: borra el volumen de MinIO
```

## Notas de la imagen

- Migraciones y seed corren desde el JS compilado, no con `ts-node`: la imagen
  no lleva devDependencies.
- `puppeteer` está en `dependencies` pero no se usa en `src/`: la página del BCV
  es HTML estático, se lee con `axios` + parseo. El build salta la descarga de
  Chromium. Si algún día hace falta un navegador headless, el `Dockerfile` ya
  trae el bloque "Chromium" comentado en la etapa `runtime` (pesa ~400 MB).
  Mientras no se use, se puede quitar `puppeteer` del `package.json` y ahorrar
  ~300 MB de `node_modules` en el build.
- El contenedor corre como usuario `node` (sin root) y no escribe en disco.
- Logs rotados por Docker (10 MB × 5 archivos).

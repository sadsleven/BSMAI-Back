# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# afmi-backend — imagen de producción (NestJS 11 / Node 22)
#
# Notas:
#  - `puppeteer` está en dependencies pero NO se usa en `src/` → se salta la
#    descarga de Chromium (PUPPETEER_SKIP_DOWNLOAD=1). El cron del BCV lee la
#    página con HTTP + parseo (HTML estático), sin navegador headless. Si el BCV
#    pasa a render por JS, descomenta el bloque "Chromium" de la etapa `runtime`.
#  - `bcrypt` es nativo: las etapas de instalación llevan python3/make/g++ por
#    si no hay prebuild para la plataforma.
#  - Migraciones y seed corren desde el JS compilado (`dist/runMigrations.js`,
#    `dist/seed.js`), así el runtime no necesita ts-node ni devDependencies.
# ---------------------------------------------------------------------------

# ---------- 1) deps completas (build) ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2) build ----------
FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- 3) deps de producción ----------
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- 4) runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=America/Caracas

# tzdata: los cron del BCV corren con timeZone America/Caracas.
# ca-certificates: TLS de salida.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---- Chromium (sólo si algún día se necesita Puppeteer) ----
# Descomentar este bloque y quitar PUPPETEER_SKIP_DOWNLOAD de las etapas de
# instalación. Pesa ~400 MB.
# RUN apt-get update && apt-get install -y --no-install-recommends \
#       chromium fonts-liberation libnss3 libatk-bridge2.0-0 libatk1.0-0 \
#       libcups2 libdrm2 libgbm1 libasound2 libpango-1.0-0 libxkbcommon0 \
#       libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
#     && rm -rf /var/lib/apt/lists/*
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]

.DEFAULT_GOAL := help
SHELL := /bin/bash

DC  := docker compose
API := api

.PHONY: help build up down restart stop logs logs-api logs-minio ps sh migrate seed bcv-sync deploy pull rebuild minio-console clean nuke env

help: ## Lista los comandos disponibles
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

env: ## Crea .env desde .env.example si no existe
	@test -f .env || (cp .env.example .env && echo ".env creado desde .env.example — EDÍTALO antes de levantar")

build: ## Construye la imagen del backend
	$(DC) build

up: ## Levanta el stack en segundo plano
	$(DC) up -d

down: ## Baja el stack (conserva volúmenes)
	$(DC) down

stop: ## Detiene los contenedores sin borrarlos
	$(DC) stop

restart: ## Reinicia el backend
	$(DC) restart $(API)

logs: ## Sigue los logs de todo el stack
	$(DC) logs -f --tail=200

logs-api: ## Sigue los logs del backend
	$(DC) logs -f --tail=200 $(API)

logs-minio: ## Sigue los logs de MinIO
	$(DC) logs -f --tail=200 minio

ps: ## Estado de los contenedores
	$(DC) ps

sh: ## Shell dentro del contenedor del backend
	$(DC) exec $(API) sh

migrate: ## Corre las migraciones pendientes (TypeORM)
	$(DC) run --rm $(API) node dist/runMigrations.js

seed: ## Corre el seed (permisos, roles, super admin, bancos)
	$(DC) run --rm $(API) node dist/seed.js

bcv-sync: ## Fuerza la sincronizacion de tasas con el BCV
	$(DC) run --rm $(API) node dist/sync-bcv.js

pull: ## Trae los últimos cambios del repo
	git pull --ff-only

rebuild: ## Reconstruye sin caché y relevanta
	$(DC) build --no-cache && $(DC) up -d

deploy: pull build up migrate ## Despliegue completo: pull + build + up + migrate
	@$(DC) ps

minio-console: ## Recuerda cómo abrir la consola de MinIO
	@echo "Consola MinIO: http://127.0.0.1:9001 (usa un túnel SSH: ssh -L 9001:127.0.0.1:9001 usuario@servidor)"

clean: ## Borra contenedores e imágenes huérfanas del stack
	$(DC) down --remove-orphans
	docker image prune -f

nuke: ## PELIGRO: baja el stack y BORRA el volumen de MinIO (archivos)
	@read -p "Esto borra TODOS los archivos guardados en MinIO. Escribe 'si' para continuar: " ok; \
	[ "$$ok" = "si" ] && $(DC) down -v || echo "cancelado"

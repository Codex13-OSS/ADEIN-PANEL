# RUNBOOK — ADEIN CRM + LIA Pagaré (Entorno Local)

Cómo arrancar el stack completo de desarrollo local con los dos repositorios fusionados.

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│  ADEIN CRM (Vite)  :5173                            │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Dashboard  │  │  CRM Ventas  │  │ Documentos   │  │
│  │            │  │              │  │  ┌─────────┐ │  │
│  │            │  │              │  │  │ LIA      │ │  │
│  │            │  │              │  │  │ Pagaré   │ │  │
│  │            │  │              │  │  │ iframe   │ │  │
│  └────────────┘  └──────────────┘  │  └─────────┘ │  │
│                                    └──────────────┘  │
├──────────────────────────────────────────────────────┤
│  Lead Agent API (Node)  :3192                        │
│  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ /api/leads     │  │ /api/local/lia/handoff     │  │
│  │ /api/citas     │  │ → token → LIA :3002        │  │
│  └────────────────┘  └────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  LIA Pagaré (Express)  :3002                         │
│  Generador de contratos y pagarés                    │
├──────────────────────────────────────────────────────┤
│  MariaDB (Docker)  :3307                             │
│  Base: adein_crm_dev                                 │
└──────────────────────────────────────────────────────┘
```

## Requisitos previos

- Node.js ≥ 20
- Docker (para MariaDB)
- Claves y secretos en `~/.agentes-si-data/adein/`

## Orden de arranque

### 1. MariaDB

```bash
docker start adein-mariadb-dev
```

El contenedor expone el puerto `3307`. Las credenciales se leen de:
`~/.agentes-si-data/adein/runtime/local-db.env`

### 2. LIA Pagaré (puerto 3002)

```bash
cd /home/coco/agentes-si/projects/lia-pagare-agent-workspace
LIA_ADEIN_HANDOFF_SECRET_FILE=/home/coco/.agentes-si-data/adein/secrets/lia-handoff.secret \
PORT=3002 \
npm run web
```

> **Importante:** `LIA_ADEIN_HANDOFF_SECRET_FILE` debe apuntar al mismo secreto que usa ADEIN para firmar los tokens de handoff. Sin esta variable, el iframe de Documentos devolverá 401.

### 3. Lead Agent API (puerto 3192)

```bash
cd /home/coco/agentes-si/projects/adein-panel-agent-workspace
npm run crm:lead-agent-api
```

Este servidor:
- Conecta con MariaDB (`adein_crm_dev` en `127.0.0.1:3307`)
- Expone endpoints REST para leads y citas
- Sirve el endpoint `/api/local/lia/handoff` que genera tokens de acceso a LIA
- Usa el secreto en `~/.agentes-si-data/adein/secrets/lia-handoff.secret`

### 4. ADEIN CRM (puerto 5173)

```bash
cd /home/coco/agentes-si/projects/adein-panel-agent-workspace
npm run dev -- --host 127.0.0.1
```

Abrir en el navegador: `http://127.0.0.1:5173/`

Credenciales: `isra` / `adein123`

## Verificación

```bash
# MariaDB
docker ps --filter name=adein-mariadb-dev

# LIA
curl -s http://127.0.0.1:3002/ | head -1
# → <!DOCTYPE html>

# Lead Agent API
curl -s http://127.0.0.1:3192/api/local/lia/handoff
# → {"ok":true,"launchUrl":"http://127.0.0.1:3002/api/auth/handoff?token=..."}

# Handoff funcional (200 = OK)
TOKEN=$(curl -s http://127.0.0.1:3192/api/local/lia/handoff | python3 -c "import sys,json; print(json.load(sys.stdin)['launchUrl'].split('token=')[1].split('&')[0])")
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3002/api/auth/handoff?token=$TOKEN&embedded=1"
# → 200
```

## Detener

```bash
# ADEIN CRM: Ctrl+C en la terminal de Vite
# Lead Agent API: Ctrl+C
# LIA Pagaré: Ctrl+C

# MariaDB (si se desea apagar)
docker stop adein-mariadb-dev
```

## Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| Documentos muestra error o no carga | LIA sin `LIA_ADEIN_HANDOFF_SECRET_FILE` | Reiniciar LIA con la variable de entorno |
| Lead Agent API: `ECONNREFUSED 127.0.0.1:3307` | MariaDB no está corriendo | `docker start adein-mariadb-dev` |
| LIA: `EADDRINUSE :::3002` | Puerto ocupado por proceso anterior | `fuser -k 3002/tcp` |
| Dashboard sin datos | MariaDB sin datos de prueba | Verificar que `adein_crm_dev` tiene registros |
| iframe LIA: 401 | Secreto no coincide entre ADEIN y LIA | Verificar que ambos usan el mismo archivo de secreto |

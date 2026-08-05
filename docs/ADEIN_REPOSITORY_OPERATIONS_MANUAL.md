# ADEIN REPOSITORY OPERATIONS MANUAL

> **Autoritativo para agentes de programación.**
> Este documento es la fuente de contexto específica de ADEIN para la Oficina Virtual SI.
> Todo agente nuevo debe leerlo antes de tocar cualquier archivo del proyecto.

---

## 1. ARQUITECTURA REAL DE ADEIN

### 1.1 Proyectos originales y estado actual

ADEIN nació como dos repositorios independientes:

| Proyecto | Repositorio | Rol original |
|---|---|---|
| ADEIN PANEL (CRM) | `Codex13-OSS/ADEIN-PANEL` | Panel comercial: dashboard, CRM, campañas |
| LIA Pagaré | `lia-pagare-v3` | Generador documental: contratos y pagarés |

**Estado actual:** Los dos repositorios **no están fusionados** en un solo repo. Siguen siendo independientes pero **integrados en runtime** mediante un mecanismo de handoff autenticado. ADEIN CRM embebe LIA Pagaré como iframe en la pestaña "Documentos".

### 1.2 Componentes del stack

```
┌─────────────────────────────────────────────────────────────────┐
│  ADEIN CRM (Vite + React 18 + TypeScript)                       │
│  Puerto 5173 — Frontend SPA                                     │
│  Repo: adein-panel-agent-workspace                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │CRM Ventas│  │Negocio   │  │  Documentos   │  │
│  │          │  │          │  │Actual    │  │  ┌──────────┐ │  │
│  │          │  │          │  │          │  │  │  LIA     │ │  │
│  │          │  │          │  │          │  │  │  iframe  │ │  │
│  └──────────┘  └──────────┘  └──────────┘  │  └──────────┘ │  │
│                                             └───────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Lead Agent API (Node.js stdlib http)                           │
│  Puerto 3192 — Backend REST local                               │
│  Repo: adein-panel-agent-workspace (scripts/)                   │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ /api/local/lead-agent│  │ /api/local/lia/handoff         │  │
│  │   /leads             │  │   → HMAC-SHA256 token          │  │
│  │   /appointments      │  │   → redirect a LIA :3002       │  │
│  │   /ingestions (POST) │  │                                 │  │
│  │   /queue (POST)      │  │                                 │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  LIA Pagaré (Express)                                           │
│  Puerto 3002 — Generador documental                             │
│  Repo: lia-pagare-agent-workspace                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ GET /api/auth/handoff?token=...&embedded=1                │  │
│  │   → verifyAdeinHandoff(token, secret)                     │  │
│  │   → genera JWT interno → almacena en localStorage         │  │
│  │   → redirect a /?embedded=1                               │  │
│  │                                                           │  │
│  │ GET / → wizard paso 1 de 5 (Contrato / Pagarés / Ambos)  │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  MariaDB 11.4 (Docker)                                          │
│  Puerto 3307 → mapeado a 3306 interno                           │
│  Contenedor: adein-mariadb-dev                                  │
│  Base: adein_crm_dev                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Dependencias entre componentes

```
MariaDB :3307  ←──  Lead Agent API :3192  ←──  ADEIN CRM :5173
                                                      │
                    LIA Pagaré :3002  ←─ handoff ─────┘
                         ↑
       requiere LIA_ADEIN_HANDOFF_SECRET_FILE
       apuntando al mismo secreto que usa ADEIN
```

- **Frontend**: `src/` (React 18, TypeScript, Vite). Consume la Lead Agent API via `fetch()` desde el navegador.
- **Backend**: `scripts/adein-lead-agent-api-server.mjs` y `scripts/lib/adein-lead-agent-api.mjs`. Servidor HTTP sin Express, usando `node:http`.
- **Base de datos**: MariaDB 11.4 en Docker. Nombre de base: `adein_crm_dev`. Se conecta con `mysql2/promise`.
- **Handoff LIA**: ADEIN firma un token HMAC-SHA256 con secreto compartido. LIA verifica la firma y emite un JWT interno para la sesión del iframe.

---

## 2. GIT

### 2.1 Repositorio autoritativo

- **Remoto**: `git@github.com:Codex13-OSS/ADEIN-PANEL.git`
- **Workspace local autorizado**: `/home/coco/agentes-si/projects/adein-panel-agent-workspace`
- **Rama principal**: `main`

### 2.2 Ramas existentes (verificadas)

```
* main                              ← activa
  agentes-si/onboarding-adein-crm
  continuacion
  feat/past-date-validation
  task/20260804-235550-demo-contrato
  task/20260805-001825-selfcheck
  task/border-radius-5756e456
  task/frontend-demo-001
  task/kanban-7dbb4da6
  wt/t_b73c1689                    ← worktree
  wt/t_backend_test_001            ← worktree
```

### 2.3 Cómo llegamos al estado actual de main

Los últimos commits en main fueron realizados directamente sobre la rama (no mediante merge de feature branches) durante esta sesión de trabajo:

```
7c98146 docs: add RUNBOOK with local startup instructions for ADEIN + LIA stack
cc321f0 feat(crm): polish glass UI, enlarge card icons, integrate LIA handoff
3f7dfd2 feat: integrate local CRM lead operations
```

**No se hizo push a origin.** Los commits están solo en local.

### 2.4 Flujo de trabajo verificado

1. **Preflight obligatorio** antes de cualquier cambio:
   ```bash
   git status --short --branch
   git rev-parse HEAD
   git remote -v
   ```

2. **Crear rama** desde main para trabajo nuevo:
   ```bash
   git checkout -b task/<descripcion>
   ```

3. **Commits locales** permitidos sin autorización en cualquier rama.

4. **Worktrees**: el repositorio usa git worktrees para trabajo paralelo (directorios `.worktrees/`). Crear worktrees está permitido; no requieren push.

### 2.5 Lo que un agente NUNCA debe hacer automáticamente

- `git push` a origin/main ni a ninguna rama remota
- `git reset`, `git restore`, `git clean`, `git stash`, `git rebase`
- `git merge` a main sin autorización humana explícita
- Crear PR, tag, release o deploy

### 2.6 Cuándo se requiere aprobación humana

| Acción | ¿Requiere aprobación? |
|---|---|
| `git commit` local | No |
| `git push` a origin | **Sí, explícita** |
| `git merge` a main | **Sí, explícita** |
| `npm run build` | No (solo verificación) |
| `npm run dev` | No |
| Ejecutar scripts `db:*` o `crm:*` | **Sí, por comando específico** |
| Iniciar/detener MariaDB (docker) | No (infraestructura local) |

---

## 3. BASE DE DATOS

### 3.1 Tecnología

- **Motor**: MariaDB 11.4
- **Ejecución**: Contenedor Docker `adein-mariadb-dev`
- **Imagen**: `mariadb:11.4`
- **Puerto expuesto**: `127.0.0.1:3307 → 3306` (interno del contenedor)
- **Nombre de base**: `adein_crm_dev`

### 3.2 Conexión desde ADEIN

El backend se conecta usando `mysql2/promise` (npm: `mysql2`). La configuración de conexión se lee del archivo:

```
~/.agentes-si-data/adein/runtime/local-db.env
```

Variables que contiene (nombres, no valores):
- `ADEIN_DB_TARGET=local`
- `ADEIN_DB_HOST=127.0.0.1`
- `ADEIN_DB_PORT=3307`
- `ADEIN_DB_NAME=adein_crm_dev`
- `ADEIN_DB_USER=adein_crm_agent`
- `ADEIN_DB_PASSWORD=<secreto>`

**El archivo de entorno nunca debe leerse, imprimirse ni modificarse por un agente.**

### 3.3 Schema relevante

El schema está documentado en `docs/db/` y `docs/adein-db-model/`. El repositorio `adein-lead-agent-store.mjs` implementa el repositorio MariaDB con operaciones:

- `saveIngestion(record)` — inserta un lead procesado
- `listLeads()` — lista leads con su clasificación
- `listAppointments()` — lista citas agendadas
- `saveAppointment({ leadId, buyerName, date, time })` — agenda cita
- `saveReminder({ leadId, days })` — programa recordatorio
- `completeAppointment({ appointmentId })` — marca cita completada

Los datos actuales en desarrollo: **7 prospectos** (3 alta prioridad, 1 cita agendada, 6 revisión manual). Verificado en el dashboard durante esta sesión.

### 3.4 Migraciones y seeds

Existen scripts de migración (`db:migration:dry-run`, `db:migration-plan`) y de staging (`db:import-staging`, `crm:prospect-staging:*`). **Todos están bloqueados por defecto.** Ninguno fue ejecutado durante esta sesión.

### 3.5 Reglas para agentes

| Tipo de cambio | ¿Quién puede? | Condición |
|---|---|---|
| Código que consulta la DB (SELECT) | Backend Agent | Sin autorización adicional |
| Código que escribe en la DB (INSERT/UPDATE) | Backend Agent | Solo si la tarea lo autoriza explícitamente |
| Ejecutar migraciones | Database Agent | **Requiere autorización humana** |
| Ejecutar scripts `db:*` | Database Agent | **Requiere autorización humana por comando** |
| Modificar schema (ALTER/CREATE TABLE) | Database Agent | **Requiere autorización humana** |
| Importar datos reales | **NUNCA** | Bloqueado permanentemente |
| Conectarse a staging/producción | **NUNCA** | Bloqueado permanentemente |

---

## 4. EJECUCIÓN

### 4.1 Orden de arranque (verificado)

Los servicios deben iniciarse en este orden. Cada paso depende del anterior:

#### Paso 1: MariaDB

```bash
docker start adein-mariadb-dev
```

Verificar:
```bash
docker ps --filter name=adein-mariadb-dev --format "{{.Status}}"
# Debe mostrar: Up X seconds (healthy)
```

#### Paso 2: LIA Pagaré (puerto 3002)

```bash
cd /home/coco/agentes-si/projects/lia-pagare-agent-workspace
LIA_ADEIN_HANDOFF_SECRET_FILE=/home/coco/.agentes-si-data/adein/secrets/lia-handoff.secret \
PORT=3002 \
npm run web
```

> **CRÍTICO**: Sin `LIA_ADEIN_HANDOFF_SECRET_FILE`, la pestaña Documentos devolverá 401 y el iframe no cargará. Este fue un error real encontrado y corregido durante esta sesión.

Verificar:
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/
# Debe devolver: 200
```

#### Paso 3: Lead Agent API (puerto 3192)

```bash
cd /home/coco/agentes-si/projects/adein-panel-agent-workspace
npm run crm:lead-agent-api
```

Salida esperada:
```json
{"ok":true,"service":"adein-lead-agent-api","host":"127.0.0.1","port":3192,"database":"adein_crm_dev"}
```

> **Error conocido**: si MariaDB no está corriendo, el script falla con `ECONNREFUSED 127.0.0.1:3307`. Solución: ejecutar Paso 1.

Verificar:
```bash
curl -s http://127.0.0.1:3192/health
# → {"ok":true,"service":"adein-lead-agent-api","localOnly":true}
```

#### Paso 4: ADEIN CRM (puerto 5173)

```bash
cd /home/coco/agentes-si/projects/adein-panel-agent-workspace
npm run dev -- --host 127.0.0.1
```

Salida esperada:
```
VITE v5.4.21  ready in 395 ms
➜  Local:   http://127.0.0.1:5173/
```

### 4.2 Health check integral

```bash
# 1. MariaDB
docker ps --filter name=adein-mariadb-dev --filter health=healthy --format "{{.Names}}"
# Debe mostrar: adein-mariadb-dev

# 2. Lead Agent API
curl -s http://127.0.0.1:3192/health | grep -q '"ok":true' && echo "API OK" || echo "API FAIL"

# 3. LIA Pagaré
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/ | grep -q "200" && echo "LIA OK" || echo "LIA FAIL"

# 4. Handoff LIA (prueba de integración)
TOKEN=$(curl -s http://127.0.0.1:3192/api/local/lia/handoff | python3 -c "import sys,json; print(json.load(sys.stdin)['launchUrl'].split('token=')[1].split('&')[0])")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3002/api/auth/handoff?token=$TOKEN&embedded=1")
[ "$HTTP_CODE" = "200" ] && echo "HANDOFF OK" || echo "HANDOFF FAIL ($HTTP_CODE)"

# 5. ADEIN CRM (solo verifica que Vite responda)
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ | grep -q "200" && echo "CRM OK" || echo "CRM FAIL"
```

### 4.3 Puertos (verificados)

| Puerto | Servicio | Tecnología |
|---|---|---|
| 3307 | MariaDB | Docker |
| 3002 | LIA Pagaré | Express |
| 3192 | Lead Agent API | Node http |
| 5173 | ADEIN CRM | Vite |

### 4.4 Credenciales de login (desarrollo)

- **URL**: `http://127.0.0.1:5173/`
- **Usuario**: `isra`
- **Contraseña**: `adein123`
- **Rol**: owner (dueño/admin)

> El login es hardcodeado en `src/components/LoginView.tsx`. No hay autenticación contra base de datos en desarrollo local.

---

## 5. TESTS Y VERIFICACIÓN

### 5.1 Tests existentes

El proyecto **no tiene suite de tests unitarios** (sin `vitest`, `jest`, ni `node:test`). La verificación se basa en:

1. **Self-checks**: scripts `*self-check*.mjs` que validan contratos, schemas y configuraciones.
2. **Build check**: `npm run build` (TypeScript + Vite).
3. **Health checks HTTP** (sección 4.2).
4. **Browser QA manual**: navegar la UI y verificar datos reales.

### 5.2 Self-checks relevantes

```bash
# API del lead agent
npm run crm:lead-agent-api:self-check

# Handoff LIA
node scripts/adein-lia-handoff-self-check.mjs

# Configuración local de BD
npm run crm:local-db-config:self-check

# Schema del lead agent
npm run crm:lead-agent-schema:self-check

# Contrato del lead agent
npm run crm:lead-agent-contract:self-check

# Card icons
node scripts/card-icon-map-self-check.mjs

# Sidebar layout
node scripts/sidebar-layout-self-check.mjs
```

### 5.3 Verificación de build

```bash
npm run build
# Si falla con errores de TypeScript, el cambio no está listo.
```

### 5.4 Criterios mínimos antes de aceptar un cambio

- [ ] `git diff --check` sin errores
- [ ] `npm run build` exitoso
- [ ] Health check HTTP del Lead Agent API (`/health` → 200)
- [ ] Handoff LIA funcional (token → 200)
- [ ] UI carga sin errores de consola
- [ ] Datos del dashboard coinciden con datos reales (no mock)
- [ ] Pestaña Documentos carga el iframe de LIA correctamente

---

## 6. MAPA DE ARCHIVOS

### 6.1 Frontend (`src/`)

```
src/
├── App.tsx                          # Entry point: login → shell
├── main.tsx                         # ReactDOM root
├── vite-env.d.ts                    # Tipos Vite
├── components/
│   ├── CardIcon.tsx                 # Íconos SVG de tarjetas (44px)
│   ├── Header.tsx                   # Barra superior
│   ├── LoginView.tsx                # Login hardcodeado
│   ├── SectionCard.tsx              # Tarjeta contenedora
│   ├── Shell.tsx                    # Layout principal (sidebar + contenido)
│   ├── Sidebar.tsx                  # Navegación lateral
│   ├── StatCard.tsx                 # Tarjeta de métrica (usa CardIcon)
│   ├── StatusBadge.tsx              # Badge de estado
│   └── AdeinAnimatedBackground.tsx  # Fondo animado
├── pages/
│   ├── CrmPage.tsx                  # Página CRM (tabla de prospectos)
│   ├── CurrentBusinessPage.tsx      # Negocio actual
│   ├── DocumentsPage.tsx            # Pestaña Documentos (iframe LIA)
│   ├── OwnerDashboardPage.tsx       # Dashboard maestro
│   ├── CampaignsPage.tsx            # Campañas
│   ├── SettingsPage.tsx             # Configuración
│   └── SellersPage.tsx              # Vendedores
├── lib/
│   ├── cardIconMap.mjs/.d.mts       # Mapeo label → icono
│   ├── leadImportProgress.mjs       # Progreso de importación de leads
│   ├── sidebarLayout.mjs            # Layout del sidebar
│   ├── liaDocumentsClient.mjs       # Cliente HTTP para handoff LIA
│   ├── crmProspectStagingReadonlyApiClient.ts  # Cliente API readonly
│   ├── crmProspectStagingReadonlySnapshot.ts   # Normalización de snapshot
│   ├── dashboardMetrics.mjs         # Métricas del dashboard
│   ├── crmStorage.ts                # Almacenamiento local CRM
│   ├── importStorage.ts             # Almacenamiento de importaciones
│   ├── importNormalizer.ts          # Normalizador de datos
│   └── historicalSales*.ts          # Ventas históricas (Excel)
├── types/
│   ├── crm.ts
│   ├── dbSnapshot.ts
│   ├── importer.ts
│   └── ...
└── styles/
    ├── global.css                   # Estilos principales (glass UI, iconos)
    └── login-background.css         # Fondo del login
```

### 6.2 Backend (`scripts/`)

```
scripts/
├── adein-lead-agent-api-server.mjs  # ★ ENTRY POINT del backend
├── lib/
│   ├── adein-lead-agent-api.mjs     # ★ Servidor HTTP y rutas REST
│   ├── adein-lead-agent-store.mjs   # ★ Repositorio MariaDB
│   ├── adein-lia-handoff.mjs        # ★ Firma y verificación de tokens LIA
│   ├── adein-lead-agent-contract.mjs # Contrato de datos del lead
│   ├── adein-whatsapp-queue.mjs     # Cola de archivos WhatsApp
│   ├── adein-local-db-config.mjs    # Configuración de BD local
│   ├── db-connection.mjs            # Conexión genérica a BD
│   ├── db-health.mjs                # Health check de BD
│   ├── db-metrics.mjs               # Métricas de BD (readonly)
│   └── db-snapshot.mjs              # Snapshots de BD
├── *self-check*.mjs                 # Scripts de verificación (10+)
└── crm-prospect-staging-*.mjs       # Staging de prospectos (bloqueados)
```

### 6.3 Documentación (`docs/`)

```
docs/
├── AGENT_DEVELOPMENT_GUIDE.md       # Guía de desarrollo (leer antes de tocar)
├── RUNBOOK.md                       # Instrucciones de arranque
├── ADEIN_REPOSITORY_OPERATIONS_MANUAL.md  # ★ Este documento
├── adein-db-model/                  # Modelo de base de datos
├── db/                              # Runbooks de BD
└── demo/                            # Documentación de demo
```

### 6.4 Configuración

```
./vite.config.ts                     # Config de Vite (mínima)
./tsconfig.json                      # TypeScript strict
./package.json                       # Dependencias y scripts npm
./index.html                         # Entry HTML
./.gitignore                         # Ignora node_modules, dist, .env
```

---

## 7. REGLAS PARA AGENTES

### 7.1 FRONTEND AGENT

**Puede tocar:**
- `src/components/*.tsx`
- `src/pages/*.tsx`
- `src/styles/*.css`
- `src/lib/*` (módulos de frontend: cardIconMap, sidebarLayout, etc.)
- `index.html`, `vite.config.ts`

**No puede tocar:**
- `scripts/` (backend)
- `.env`, secretos, credenciales
- `docs/db/`, `docs/adein-db-model/`

**Debe probar:**
- `npm run build` exitoso
- UI carga en `http://127.0.0.1:5173/`
- Sin errores en consola del navegador
- Las 4 pestañas principales navegan correctamente
- La pestaña Documentos carga el iframe de LIA
- Los datos mostrados son reales (no mock/demo)

### 7.2 BACKEND AGENT

**Puede tocar:**
- `scripts/adein-lead-agent-api-server.mjs`
- `scripts/lib/adein-lead-agent-api.mjs`
- `scripts/lib/adein-lead-agent-store.mjs`
- `scripts/lib/adein-lia-handoff.mjs`
- `scripts/lib/adein-lead-agent-contract.mjs`
- `scripts/lib/adein-whatsapp-queue.mjs`

**No puede tocar:**
- `.env`, `local-db.env`, archivos de secretos
- Scripts `db:*` sin autorización explícita
- Scripts `crm:prospect-staging:*` sin autorización explícita
- `src/` (frontend) sin coordinación con Frontend Agent

**Debe probar:**
- `npm run crm:lead-agent-api:self-check`
- Health check: `curl http://127.0.0.1:3192/health`
- Leads: `curl http://127.0.0.1:3192/api/local/lead-agent/leads`
- Handoff LIA funcional (sección 4.2)
- La API solo escucha en `127.0.0.1` (nunca en `0.0.0.0`)

### 7.3 DATABASE AGENT

**Puede tocar:**
- **Solo código que consulta la BD** (`SELECT`) como parte de una tarea autorizada
- **Solo schemas/migraciones** cuando la tarea lo autoriza explícitamente

**No puede tocar:**
- Datos reales, producción o staging
- El archivo `local-db.env`
- El contenedor Docker (solo iniciar/detener, nunca modificar)

**Debe escalar:**
- Cualquier cambio que requiera ejecutar scripts `db:*`
- Cualquier escritura en la BD
- Cualquier modificación de schema

### 7.4 QA AGENT

**Debe verificar:**
- Health check integral (sección 4.2)
- `npm run build` sin errores
- Navegación completa de la UI
- Datos del dashboard vs datos reales de la API
- Handoff LIA funcional
- Sin errores de consola en el navegador
- Glass UI no opaca datos ni animación de fondo
- Iconos de tarjetas visibles y proporcionados

### 7.5 GIT AGENT

**Puede integrar:**
- Commits locales en cualquier rama
- Crear ramas desde main
- Crear worktrees
- `git diff --check`, `git status`

**No puede sin autorización:**
- Push a origin
- Merge a main
- PR, tag, release

---

## 8. DEFINITION OF DONE DE ADEIN

Una tarea de programación en ADEIN sigue este flujo. Cada paso debe completarse antes de avanzar:

```
1. INSTRUCCIÓN
   └─ Leer AGENTS.md, este manual, y docs/AGENT_DEVELOPMENT_GUIDE.md

2. ANÁLISIS (preflight)
   └─ git status --short --branch
   └─ git rev-parse HEAD
   └─ Identificar archivos afectados
   └─ Trazar dependencias (frontend ↔ backend ↔ DB)

3. WORKTREE O RAMA
   └─ git checkout -b task/<descripcion>
   └─ O git worktree add para trabajo paralelo

4. IMPLEMENTACIÓN
   └─ Código mínimo necesario
   └─ No refactors innecesarios
   └─ No tocar archivos fuera del scope

5. TESTS
   └─ npm run build exitoso
   └─ Self-checks relevantes
   └─ Health checks HTTP

6. VERIFICACIÓN
   └─ Levantar stack completo (sección 4)
   └─ Browser QA: verificar UI, consola, datos
   └─ Probar integración LIA (pestaña Documentos)

7. LOCAL COMMIT (cuando corresponda)
   └─ git add <archivos del cambio>
   └─ git commit -m "tipo(scope): descripcion"
   └─ NO hacer push

8. RECEIPT
   └─ git diff --check
   └─ git diff --name-only
   └─ git log --oneline -1
   └─ Resumen de lo hecho + archivos modificados

9. READY_FOR_REVIEW
   └─ Reportar: "READY_FOR_REVIEW"
   └─ Incluir: branch, diff, build status, health checks
   └─ NO hacer push, merge ni deploy
   └─ Esperar revisión humana
```

---

## 9. LECCIONES DEL TRABAJO REAL

### 9.1 El handoff LIA requiere variable de entorno explícita

**Problema**: La pestaña Documentos mostraba el iframe pero no cargaba LIA (401 Unauthorized).

**Causa**: LIA necesita `LIA_ADEIN_HANDOFF_SECRET_FILE` para verificar los tokens HMAC-SHA256 que ADEIN genera. Sin esta variable, `loadAdeinHandoffSecret()` lanza error y el endpoint `/api/auth/handoff` devuelve 401.

**Solución**: Arrancar LIA con:
```bash
LIA_ADEIN_HANDOFF_SECRET_FILE=/home/coco/.agentes-si-data/adein/secrets/lia-handoff.secret PORT=3002 npm run web
```

El valor por defecto de `PORT` en LIA es 3000 (no 3002). El ADEIN CRM espera LIA en `http://127.0.0.1:3002` (hardcodeado en `scripts/adein-lead-agent-api-server.mjs`). Por tanto, **siempre se debe pasar `PORT=3002` explícitamente**.

### 9.2 MariaDB debe iniciarse antes que la API

**Problema**: La Lead Agent API falla con `ECONNREFUSED 127.0.0.1:3307` si el contenedor Docker no está corriendo.

**Solución**: `docker start adein-mariadb-dev` antes de `npm run crm:lead-agent-api`.

### 9.3 El login usa credenciales hardcodeadas

El componente `LoginView.tsx` (línea 10-11) define:
```typescript
const ALLOWED_USERNAME = 'isra';
const ALLOWED_PASSWORD = 'adein123';
```

Esto significa que **no se necesita base de datos para autenticarse** en desarrollo local. Cualquier cambio en el flujo de login debe mantener este comportamiento o coordinarse con el backend.

### 9.4 Los datos del dashboard son reales, no mock

Los 7 prospectos, 3 alta prioridad, 1 cita y 6 revisión manual vienen de la API (`/api/local/lead-agent/leads`), que consulta MariaDB. Si el dashboard muestra ceros o datos inconsistentes, **el problema está en la conexión MariaDB → API**, no en el frontend.

### 9.5 El glass UI es CSS puro, no una librería

El efecto vidrio (backdrop-filter, gradientes semitransparentes) está implementado en `src/styles/global.css` (líneas 367-383). No depende de Tailwind ni librerías externas. Los valores clave:

- Opacidad de tarjetas: `rgba(255,255,255,.22)` / `rgba(238,246,240,.12)`
- Blur: `26px`
- Sidebar: tinte verde `rgba(238,246,240,.48)`
- Íconos: 44px contenedor, SVG 24px

Cualquier modificación visual debe mantener la legibilidad de los datos y permitir ver la animación de fondo.

### 9.6 Los dos repositorios son independientes

**No copiar archivos entre `adein-panel-agent-workspace` y `lia-pagare-agent-workspace`.** La integración es solo mediante el handoff HTTP. Si una tarea requiere cambios en ambos repositorios, se trata como dos tareas separadas coordinadas.

### 9.7 La API solo escucha en localhost

`scripts/adein-lead-agent-api-server.mjs` (línea 16):
```javascript
if (host !== '127.0.0.1') throw new Error('El API local sólo puede escuchar en 127.0.0.1');
```

Esto es una protección. **No se debe modificar.** La API nunca debe exponerse en `0.0.0.0`.

### 9.8 El build de TypeScript es estricto

`tsconfig.json` tiene `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Código con variables sin usar o tipos incorrectos **romperá el build**.

### 9.9 .hermes/, .vite/ y .worktrees/ no se versionan

Son directorios de trabajo locales. Están en `.gitignore` (`.vite/` y `.worktrees/` no explícitamente, pero `dist/` y `build/` sí). Un agente nunca debe hacer `git add` de estos directorios.

---

## APÉNDICE: LIA PAGARÉ (referencia rápida)

Para tareas que requieran contexto del generador documental:

- **Repo**: `/home/coco/agentes-si/projects/lia-pagare-agent-workspace`
- **Rama**: `main` en commit `dc213ac feat: support embedded ADEIN document handoff`
- **Arranque**: `PORT=3002 npm run web` (Express, CommonJS)
- **AGENTS.md**: Leer antes de tocar (`/home/coco/agentes-si/projects/lia-pagare-agent-workspace/AGENTS.md`)
- **Handoff**: `src/integrations/adeinHandoff.js` — `verifyAdeinHandoff({ token, secret, now })`
- **Prohibido**: modificar `templates/base.pdf`, `config/mapping_v1.json` (tienen diferencias manuales no reconciliadas con producción)

---

> **Versión**: 1.0 — Generado durante la sesión de trabajo del 2026-08-04.
> **Verificado con**: stack completo corriendo (MariaDB, LIA, Lead Agent API, ADEIN CRM).
> **Estado del repositorio al cierre**: `main` en `7c98146`, sin cambios sin commitear, servidores vivos.

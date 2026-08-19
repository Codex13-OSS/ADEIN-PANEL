# ADEIN — Arquitectura canónica

**Estado:** CANÓNICO
**Última actualización:** 2026-08-19

Este documento describe la arquitectura durable de ADEIN.

No reconstruir el sistema desde memoria conversacional cuando exista evidencia verificable.

---

## 1. Fuentes de verdad

Orden obligatorio:

1. Estado comprobado del repo/local/servidor.
2. Archivos canónicos de arquitectura y estado dentro del repo.
3. Git/GitHub.
4. Migraciones y esquema real de MariaDB.
5. Evidencia de Docker/runtime.
6. Chats anteriores únicamente como contexto histórico.

Todo dato técnico no confirmado debe marcarse:

`PENDIENTE DE VERIFICACIÓN`

---

## 2. Flujo oficial

```text
ADEIN local
→ pruebas determinísticas
→ QA humana
→ GitHub
→ Contabo producción
```

GitHub es el source-of-truth del código.

MariaDB local y MariaDB de producción son ambientes separados.

```text
estructura SQL compatible
datos locales ≠ datos producción
```

Los datos de QA locales no se copian automáticamente a producción.

Los cambios de esquema viajan mediante migraciones versionadas y verificables.

---

## 3. Componentes principales

ADEIN está compuesto por tres sistemas relacionados pero independientes.

### 3.1 ADEIN-PANEL

CRM privado principal.

Ruta local comprobada:

```text
/home/coco/agentes-si/projects/adein-panel-agent-workspace
```

Remote:

```text
git@github.com:Codex13-OSS/ADEIN-PANEL.git
```

Stack comprobado:

```text
React
TypeScript
Vite
Node.js
mysql2
MariaDB
Docker Compose
Nginx
```

Responsabilidades:

- CRM privado.
- Prospectos.
- Citas.
- Leads.
- Propiedades.
- Inventario.
- Publicación inmobiliaria.
- Media de propiedades.
- Integración con LIA-PAGARE.
- API pública para el sitio ADEIN.

---

### 3.2 ADEIN PUBLIC SITE

Sitio público independiente del CRM.

Ruta:

```text
/home/coco/agentes-si/projects/adein-public-site-workspace
```

Remote:

```text
git@github.com:Codex13-OSS/ADEIN-PUBLIC-SITE.git
```

Arquitectura contractual:

```text
MariaDB
→ ADEIN backend
→ API pública / DTO estable
→ ADEIN Public Site
```

Regla:

El diseño HTML/CSS del sitio público no debe imponer cambios innecesarios a MariaDB.

El Public Site debe adaptarse al contrato público de ADEIN.

---

### 3.3 LIA-PAGARE

Generador documental independiente.

Ruta:

```text
/home/coco/agentes-si/projects/lia-pagare-agent-workspace
```

Remote:

```text
git@github.com:Codex13-OSS/LIA-PAGARE-WEB.git
```

Arquitectura:

```text
ADEIN
→ handoff autenticado
→ LIA-PAGARE
→ generación documental
```

LIA se integra visualmente dentro de ADEIN, pero conserva runtime independiente.

Política actual:

```text
READ_ONLY salvo autorización explícita
```

---

## 4. Estado Git comprobado

### ADEIN-PANEL

```text
branch=task/adein-properties-media-contract-008
HEAD=23af7476a16d2dc95251a4439256f436c3649875
main=23af7476a16d2dc95251a4439256f436c3649875
origin/main=23af7476a16d2dc95251a4439256f436c3649875
```

El worktree está DIRTY.

No ejecutar sin autorización:

```text
git reset
git clean
git stash
checkout destructivo
```

---

### ADEIN PUBLIC SITE

```text
branch=main
HEAD=a0f351ca7cfd4fab9790acb162827dcbd42dcb25
worktree_dirty=true
```

Cambio observado:

```text
M index.html
```

---

### LIA-PAGARE

```text
branch=main
HEAD=dc213aca0b31ffaf0478472d317fed416ed07d84
worktree_dirty=true
```

Cambios observados:

```text
M server.js
M web/app.js
M web/index.html
```

No descartar esos cambios automáticamente.

---

## 5. Docker local ADEIN

Compose comprobado:

```text
services:
  db
  lead-agent
  web
```

Stack saludable:

```text
adein-release-test-db-1
adein-release-test-lead-agent-1
adein-release-test-web-1
```

Estado observado:

```text
db          healthy
lead-agent  healthy
web         healthy
```

Puertos:

```text
web:
  host :8080
  container :80

lead-agent:
  :3192 interno Docker

MariaDB:
  :3306 interno Docker
```

Persistencia:

```text
adein_mariadb_data
adein_property_media
```

Archivos principales:

```text
compose.yaml
Dockerfile.lead-agent
Dockerfile.web
nginx.conf
```

MariaDB:

```text
mariadb:11
```

Existe adicionalmente:

```text
adein-panel-agent-workspace-lead-agent-1
```

observado como:

```text
unhealthy
```

No reiniciar, borrar ni recrear ese contenedor sin diagnóstico y autorización.

---

## 6. Frontend local

El frontend de desarrollo se ha validado manualmente mediante Vite en:

```text
http://127.0.0.1:5174/
```

Este runtime dev es diferente del frontend Docker servido en host `:8080`.

No canonizar direcciones IP internas de Docker porque pueden cambiar.

---

## 7. Nginx

Configuración actual comprobada en `nginx.conf`.

Flujo:

```text
Browser
  ↓
Nginx :80
  ├─ SPA ADEIN
  ├─ /api/local/*  → lead-agent:3192
  ├─ /api/public/* → lead-agent:3192
  └─ LIA           → host.docker.internal:3103
```

El área privada utiliza Basic Auth.

La API pública:

```text
/api/public/
```

tiene Basic Auth desactivado para consumo público.

Rutas LIA relevantes:

```text
/lia/*
/lia/api/auth/handoff
/api/auth/verify
/api/auth/*
/api/capturas
/api/generar
/api/descargar/*
/api/print/*
```

El handoff root:

```text
/api/auth/handoff
```

está intencionalmente bloqueado.

El handoff válido embebido es:

```text
/lia/api/auth/handoff
```

---

## 8. Backend ADEIN

Entrypoints:

```text
scripts/adein-lead-agent-api-server.mjs
scripts/lib/adein-lead-agent-api.mjs
```

Puerto por defecto:

```text
3192
```

Configuración DB por defecto:

```text
host=127.0.0.1
port=3306
database=adein_crm_dev
user=adein
```

Las credenciales reales permanecen fuera del código.

Archivos/config externos relevantes:

```text
~/.agentes-si-data/adein/runtime/local-db.env
~/.agentes-si-data/adein/secrets/lia-handoff.secret
~/.agentes-si-data/adein/secrets/owner-auth.json
~/.agentes-si-data/adein/media
```

Colas locales:

```text
/tmp/adein-whatsapp/entrada
/tmp/adein-whatsapp/procesados
```

Rutas comprobadas:

```text
GET  /health

GET  /api/public/listings

POST /api/local/auth/login
GET  /api/local/auth/session

GET  /api/local/properties
POST /api/local/properties

GET  /api/local/lead-agent/leads
GET  /api/local/lead-agent/appointments
POST /api/local/lead-agent/queue
POST /api/local/lead-agent/ingestions

GET  /api/local/lia/handoff
```

Existen además rutas específicas de Properties, listings, features y media implementadas en la rama de trabajo actual.

---

## 9. Autenticación

ADEIN dispone de autenticación owner local.

Configuración externa:

```text
~/.agentes-si-data/adein/secrets/owner-auth.json
```

El archivo fue comprobado estructuralmente durante QA.

No almacenar valores secretos en este documento.

No imprimir:

```text
password
salt
session secret
token
hash sensible
```

LIA mantiene su propia autenticación y handoff.

---

## 10. MariaDB local

Base comprobada:

```text
adein_crm_dev
```

Huella determinística actual:

```text
TABLE_COUNT=22
SCHEMA_SHA256=83236401185dc1306728b15956de83175e1b12254566c2b278eef2295a6b88dd
```

Tablas comprobadas:

```text
adein_commercial_analysis_history
adein_leads
adein_lead_analysis_events
adein_lead_appointments
adein_processed_files
audit_log
clients
contracts
crm_followups
crm_users
import_batches
import_raw_rows
lots
migration_plans
migration_plan_events
payment_schedule
properties
property_listings
property_listing_features
property_listing_images
property_listing_operations
sellers
```

---

## 11. Relaciones de negocio relevantes

### CRM / Leads

```text
adein_leads
├─ inventory_property_id → properties.id
└─ inventory_lot_id      → lots.id
```

```text
adein_lead_analysis_events
└─ lead_id → adein_leads.id
```

```text
adein_lead_appointments
└─ lead_id → adein_leads.id
```

---

### Propiedades

```text
properties
├─ lots
└─ property_listings
   ├─ property_listing_features
   ├─ property_listing_images
   └─ property_listing_operations
```

---

### Clientes / contratos

```text
clients
└─ assigned_seller_id → sellers.id
```

```text
contracts
├─ client_id → clients.id
├─ lot_id    → lots.id
└─ seller_id → sellers.id
```

```text
payment_schedule
└─ contract_id → contracts.id
```

```text
crm_followups
├─ client_id → clients.id
└─ seller_id → sellers.id
```

---

### Migración histórica

```text
import_batches
└─ import_raw_rows
```

```text
migration_plans
└─ migration_plan_events
```

Existe `audit_log` para trazabilidad.

---

## 12. Migraciones SQL

Presentes:

```text
001_initial_schema.sql
002_seed_demo_optional.sql
003_crm_prospect_staging_schema_v063.sql
004_adein_local_lead_agent_schema.sql
005_commercial_intelligence_v1.sql
006_adein_unified_business_schema.sql
007_crm_lead_inventory_interest.sql
008_property_listing_media_contract.sql
```

Línea canónica documentada:

```text
004 → 005 → 006
```

`001_initial_schema.sql` se conserva como antecedente histórico.

El esquema local actual demuestra además los efectos estructurales de:

```text
007
008
```

---

## 13. Registro de migraciones

Actualmente NO existe una tabla técnica comprobada como:

```text
schema_migrations
```

Las tablas:

```text
migration_plans
migration_plan_events
```

son parte del dominio de migración de datos y no representan un ledger técnico de DDL aplicado.

Consecuencia:

Antes de producción no debe asumirse una versión de esquema por memoria o nombre de archivo.

Debe compararse el esquema real.

---

## 14. Migración 006

Documento:

```text
docs/db/006_adein_unified_business_migration_runbook.md
```

Principios:

- dry-run por defecto;
- apply local protegido;
- backup obligatorio;
- SHA256 del backup;
- producción bloqueada por ese tooling;
- rollback mediante restauración controlada del backup;
- no confiar en rollback transaccional para DDL.

---

## 15. Properties

Modelo:

```text
properties
→ property_listings
→ property_listing_features
→ property_listing_images
→ property_listing_operations
```

`property_listings` incluye entre otros:

```text
slug
title
description
property_type
operation_code
location_key
location_label
price_mode
price_amount
currency
price_display_override
commercial_badge
publication_status
display_order
published_at
unpublished_at
```

`property_listing_images` incluye:

```text
storage_key
content_type
size_bytes
checksum_sha256
alt_text
sort_order
is_cover
```

Índices 008 comprobados:

```text
idx_property_listings_operation
idx_property_listing_images_checksum
```

Media:

```text
archivo persistente
+
metadata MariaDB
```

---

## 16. Contrato público de Properties

El backend expone catálogo público mediante:

```text
GET /api/public/listings
```

Contrato funcional validado incluye:

```text
id
propertyId
slug
title
description
propertyType
operation
locationKey
location
price
priceMode
priceDisplay
currency
badge
displayOrder
publishedAt
features
images
lotsSummary
```

Cada imagen pública incluye:

```text
id
url
storageKey
altText
isCover
sortOrder
```

El Public Site consume este contrato.

---

## 17. Publicación de propiedades

Estados soportados:

```text
draft
published
unpublished
```

El contrato local validado contempla:

- publicar;
- despublicar;
- `published_at`;
- `unpublished_at`;
- exclusión pública de propiedades inactivas;
- cover único;
- orden de imágenes;
- eliminación de archivo + metadata;
- media pública servida por backend.

---

## 18. Reglas de migración de datos

Documento durable:

```text
docs/adein-db-model/migration-rules.md
```

Principios:

```text
no perder información histórica
conservar raw original
conservar normalizado
conservar archivo/hoja/fila origen
no borrar duplicados
marcar duplicados para revisión
usar audit_log
conservar teléfonos originales
conservar direcciones/observaciones raw
review_required ante ambigüedad
usar datos sintéticos en QA
BD real reemplaza localStorage como storage principal
```

---

## 19. Separación local / producción

Local:

```text
desarrollo
QA
datos sintéticos
```

Producción:

```text
datos reales
```

Nunca:

```text
copiar BD local completa a producción
reemplazar producción con QA local
copiar automáticamente datos sintéticos
```

Las migraciones viajan por Git.

Los datos reales permanecen en producción.

---

## 20. Producción histórica comprobada

Existe evidencia operacional del 26 de mayo de 2026.

Servidor histórico:

```text
38.242.222.25
```

Producción:

```text
PM2=adein-panel-v040
port=3006
```

Staging:

```text
port=3016
```

Bridge read-only:

```text
127.0.0.1:3091
```

Ese estado está clasificado:

```text
HISTÓRICO VERIFICADO
```

No asumir que sigue vigente.

---

## 21. Línea Docker de agosto

Existe la siguiente línea Git:

```text
3e90c14  package production docker stack
aee7e3a  support Docker env vars
836ef0d  docker production validation tooling
93a721a  deployment safeguards
8d2a206  same-origin LIA routing
4954217  secure handoff secret mount
cf288e0  private beta release hardening
```

Todos pertenecen al linaje del HEAD base actual.

El runbook asociado declara explícitamente:

```text
Solo plan
```

Por tanto:

No constituye por sí mismo evidencia de que Contabo haya migrado realmente de PM2 a Docker.

---

## 22. Estado actual de Contabo

Pendiente de verificación determinística:

```text
CURRENT_CONTABO_RUNTIME=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_SHA=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_BRANCH=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_SCHEMA=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_SCHEMA_SHA256=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_PORTS=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_NGINX=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_CONTAINERS=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_BACKUPS=PENDIENTE_DE_VERIFICACION
CURRENT_CONTABO_RELEASE_PATH=PENDIENTE_DE_VERIFICACION
```

No rellenar estos campos desde memoria.

---

## 23. Deploy seguro

Flujo obligatorio:

```text
trabajo local
→ pruebas determinísticas
→ QA humana
→ release congelado
→ commit autorizado
→ push autorizado
→ GitHub
→ preflight producción
→ backup producción verificable
→ obtener esquema producción
→ comparar esquema
→ aplicar sólo migraciones pendientes autorizadas
→ health checks
→ smoke tests
→ rollback preparado
```

---

## 24. Backup

Antes de una operación de producción:

- backup real;
- comprobar que no esté vacío;
- verificar integridad;
- calcular hash cuando corresponda;
- almacenar fuera de Git;
- conservar ruta de rollback.

Nunca asumir que Git puede restaurar datos de MariaDB.

---

## 25. Rollback

Código y datos se recuperan por mecanismos separados.

Código:

```text
Git/release anterior
```

Datos:

```text
backup MariaDB verificable
```

No ejecutar restore automáticamente.

Restore de producción requiere autorización humana explícita.

---

## 26. QA

Principio:

No repetir auditorías ya PASS salvo que cambie la fuente relevante.

Priorizar:

```text
self-check determinístico
build
git diff --check
API real
MariaDB real
QA humana
```

No usar modelos para verificaciones que puedan resolverse determinísticamente.

---

## 27. Agentes

Hermes / ChatGPT:

```text
operador
orquestador
diagnóstico
continuidad
```

No son la única fuente de conocimiento.

Codex:

```text
código
Git
tests
scripts
documentación
frontend
backend
integraciones
```

Ningún agente debe depender del historial completo de un chat para conocer ADEIN.

La arquitectura debe vivir en el repo.

---

## 28. Principio fundamental de negocio

Toda función crítica debe poder ejecutarse manualmente dentro de ADEIN.

Los agentes pueden automatizar funciones, pero no deben ser sus únicos propietarios.

---

## 29. Seguridad

No ejecutar automáticamente:

```text
DROP
TRUNCATE
reset destructivo
clean destructivo
borrado masivo
docker system prune no verificado
restore producción
migración producción
push
merge
deploy
```

No modificar producción sin autorización explícita.

No modificar MariaDB producción sin:

```text
backup
preflight
autorización explícita
```

No imprimir:

```text
passwords
tokens
secrets
hashes sensibles
```

---

## 30. Documentos durables

Principales:

```text
docs/ADEIN_ARCHITECTURE.md
docs/ADEIN_CURRENT_STATE.md
docs/adein-db-model/migration-rules.md
docs/db/006_adein_unified_business_migration_runbook.md
compose.yaml
nginx.conf
docs/db/*.sql
Git/GitHub
Docker real
MariaDB real
```

Runbooks que deben revalidarse antes de ejecutar:

```text
docs/ADEIN_DOCKER_DEPLOYMENT.md
docs/DEPLOY_PRIVATE_BETA_RUNBOOK.md
docs/ADEIN_REPOSITORY_OPERATIONS_MANUAL.md
```

Documento histórico NO canónico:

```text
.hermes/plans/CURRENT_ARCHITECTURE.md
```

Ese documento contiene arquitectura y runtime anteriores y no debe utilizarse como estado actual sin revalidación.

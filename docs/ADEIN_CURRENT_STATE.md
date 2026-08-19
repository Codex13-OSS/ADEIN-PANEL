# ADEIN — Estado actual

**Estado:** CANÓNICO / ACTUALIZABLE
**Snapshot:** 2026-08-19

Este archivo es el checkpoint operativo de ADEIN.

Un chat o agente nuevo debe leer primero:

```text
docs/ADEIN_ARCHITECTURE.md
docs/ADEIN_CURRENT_STATE.md
```

y verificar únicamente aquello que pueda haber cambiado.

---

## 1. ADEIN-PANEL

```text
repo=/home/coco/agentes-si/projects/adein-panel-agent-workspace
remote=git@github.com:Codex13-OSS/ADEIN-PANEL.git
branch=task/adein-properties-media-contract-008
HEAD=23af7476a16d2dc95251a4439256f436c3649875
main=23af7476a16d2dc95251a4439256f436c3649875
origin/main=23af7476a16d2dc95251a4439256f436c3649875
```

Estado:

```text
WORKTREE_DIRTY=true
COMMIT_PENDING=true
PUSH_PENDING=true
DEPLOY_PENDING=true
```

No ejecutar reset, clean, stash o descarte masivo.

---

## 2. Cambios locales ADEIN-PANEL

Archivos modificados comprobados:

```text
compose.yaml
nginx.conf
scripts/adein-lead-agent-api-server.mjs
scripts/lib/adein-lead-agent-api.mjs
scripts/lib/adein-lead-agent-store.mjs
scripts/lib/adein-local-db-config.mjs
src/App.tsx
src/components/LoginView.tsx
src/components/Shell.tsx
src/components/Sidebar.tsx
src/lib/runtimeConfig.ts
src/pages/CrmPage.tsx
src/styles/global.css
vite.config.ts
```

Archivos nuevos relevantes:

```text
docs/db/006_adein_unified_business_migration_runbook.md
docs/db/006_adein_unified_business_schema.sql
docs/db/007_crm_lead_inventory_interest.sql
docs/db/008_property_listing_media_contract.sql

scripts/adein-lead-inventory-interest-self-check.mjs
scripts/adein-owner-auth-self-check.mjs
scripts/adein-properties-api-self-check.mjs
scripts/adein-property-feature-api-self-check.mjs
scripts/adein-property-listing-api-self-check.mjs
scripts/adein-property-media-api-self-check.mjs
scripts/adein-property-media-self-check.mjs
scripts/adein-unified-schema-006-safety-self-check.mjs
scripts/adein-unified-schema-006-self-check.mjs
scripts/adein-unified-schema-006.mjs
scripts/lib/adein-owner-auth.mjs
scripts/lib/adein-property-media-store.mjs

src/pages/PropertiesAdminPage.tsx
src/pages/PropertiesPage.tsx
```

No eliminar archivos untracked sin revisión.

---

## 3. Runtime Docker local

Saludable:

```text
adein-release-test-db-1          healthy
adein-release-test-lead-agent-1  healthy
adein-release-test-web-1         healthy
```

Puertos:

```text
web host :8080 → container :80
lead-agent :3192 interno
MariaDB :3306 interno
```

Persistencia:

```text
adein_mariadb_data
adein_property_media
```

Existe adicionalmente:

```text
adein-panel-agent-workspace-lead-agent-1
```

observado:

```text
unhealthy
```

No tocarlo sin necesidad demostrada.

---

## 4. Frontend dev

QA humana local realizada mediante:

```text
http://127.0.0.1:5174/
```

Vite usa proxy `/api`.

La dirección IP interna del backend Docker no debe almacenarse como dato permanente.

---

## 5. MariaDB local

```text
DB=adein_crm_dev
TABLE_COUNT=22
SCHEMA_SHA256=83236401185dc1306728b15956de83175e1b12254566c2b278eef2295a6b88dd
```

Migraciones presentes:

```text
001
002
003
004
005
006
007
008
```

El esquema local refleja estructuralmente:

```text
006
007
008
```

No existe ledger técnico formal de versiones DDL.

---

## 6. 007 confirmada

`adein_leads` contiene:

```text
inventory_property_id
inventory_lot_id
```

FK comprobadas:

```text
inventory_property_id → properties.id
inventory_lot_id      → lots.id
```

Índices comprobados:

```text
idx_adein_leads_inventory_property_id
idx_adein_leads_inventory_lot_id
```

---

## 7. 008 confirmada

`property_listings` contiene:

```text
operation_code
```

`property_listing_images` contiene:

```text
checksum_sha256
```

Índices comprobados:

```text
idx_property_listings_operation
idx_property_listing_images_checksum
```

---

## 8. Properties — estado funcional

```text
IMPLEMENTATION_LOCAL=true
PHASE_1_CONTRACT_PASS=true
PHASE_2_ADMIN_UI_IMPLEMENTED=true
QA_HUMANA_INICIADA=true
QA_HUMANA_FUNCIONAL_PASS=true
COMMIT_PENDING=true
PUSH_PENDING=true
DEPLOY_PENDING=true
```

Capacidades locales:

```text
crear propiedad
editar datos generales
activar/inactivar
crear listing público
editar listing
precio
operación
features
subir fotos multipart
thumbnails
cover
reordenar fotos
eliminar fotos
publicar
despublicar
lotes
```

---

## 9. Properties — archivos principales

```text
src/pages/PropertiesAdminPage.tsx
src/pages/PropertiesPage.tsx
scripts/lib/adein-property-media-store.mjs
scripts/lib/adein-lead-agent-store.mjs
scripts/lib/adein-lead-agent-api.mjs
scripts/adein-lead-agent-api-server.mjs
docs/db/007_crm_lead_inventory_interest.sql
docs/db/008_property_listing_media_contract.sql
```

---

## 10. QA Properties ya confirmada

No repetir sin cambio de fuente relevante:

```text
git diff --check PASS
npm run build PASS

migration 006 PASS
migration 007 PASS
migration 008 PASS

property/media self-checks PASS
public media contract PASS
publication contract PASS
runtime E2E real PASS
login local PASS
```

---

## 11. Properties — QA humana observada

UI funcional comprobada manualmente.

Se observaron propiedades como:

```text
La zapata
La Joaya
QA FASE3 Inventario Local
```

La UI permite seleccionar propiedades y editar publicación.

QA humana final confirmada:
- carga de Properties PASS;
- edición y guardado de datos PASS;
- subida de imagen PASS.

Se aplicó hotfix visual para acciones principales de Properties.

No reabrir el problema de botones invisibles salvo regresión comprobada.

---

## 12. Simplificación futura de UI

Idea pendiente, no obligatoria para cerrar funcionalidad:

```text
Datos
→ Fotos
→ Publicar
```

Posible simplificación:

- integrar Precio dentro de Información pública;
- features como sección secundaria/colapsable;
- lotes como sección secundaria/colapsable.

QA funcional actual cerrada.

La simplificación futura debe ser principalmente de frontend:
- no cambiar MariaDB salvo necesidad demostrada;
- no romper el contrato API actual;
- ocultar o reorganizar campos sin eliminar capacidad del backend.

Trabajo candidato para Codex Cloud después del baseline GitHub.

---

## 13. Auth

Login local:

```text
PASS
```

Owner auth externo configurado.

No modificar secretos.

No imprimir valores sensibles.

Auth/infrastructure se considera cerrada salvo nueva evidencia de fallo.

---

## 14. Public Site

```text
repo=/home/coco/agentes-si/projects/adein-public-site-workspace
remote=git@github.com:Codex13-OSS/ADEIN-PUBLIC-SITE.git
branch=main
HEAD=a0f351ca7cfd4fab9790acb162827dcbd42dcb25
worktree_dirty=true
```

Cambio observado:

```text
M index.html
```

Integración dinámica final:

```text
PENDIENTE
```

Plan:

```text
1. conservar catálogo hardcoded actual
2. integrar una propiedad dinámica desde API local
3. comparar diseño
4. expandir catálogo dinámico
5. mantener fallback temporal
6. retirar hardcode sólo tras QA
7. desplegar sólo después de QA local
```

No modificar el sitio público en producción durante esta fase.

---

## 15. LIA-PAGARE

```text
repo=/home/coco/agentes-si/projects/lia-pagare-agent-workspace
remote=git@github.com:Codex13-OSS/LIA-PAGARE-WEB.git
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

Política:

```text
READ_ONLY salvo autorización explícita
```

No resetear ni sobrescribir esos cambios.

---

## 16. GitHub

ADEIN-PANEL:

```text
origin/main=23af7476a16d2dc95251a4439256f436c3649875
```

El commit:

```text
23af7476a16d2dc95251a4439256f436c3649875
```

reconcilió `main` local con `origin/main`.

Los cambios actuales de Properties son posteriores y siguen locales.

No push ni merge sin autorización explícita.

---

## 17. Producción histórica

Último estado operacional comprobado:

```text
fecha=2026-05-26
server=38.242.222.25
production_port=3006
production_pm2=adein-panel-v040
staging_port=3016
readonly_bridge=127.0.0.1:3091
```

Clasificación:

```text
HISTÓRICO VERIFICADO
```

No asumir vigente.

---

## 18. Línea Docker posterior

Commits comprobados:

```text
3e90c14
aee7e3a
836ef0d
93a721a
8d2a206
4954217
cf288e0
```

Son ancestros del HEAD actual.

Representan arquitectura/release Docker preparada y endurecida.

No existe evidencia suficiente en el repo para afirmar que esa arquitectura reemplazó realmente al runtime de producción.

---

## 19. Contabo actual

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
```

No conectar ni modificar producción durante la fase local actual sin autorización explícita.

---

## 20. Regla para próximo release DB

Nunca copiar la BD local completa a producción.

Secuencia:

```text
1. cerrar QA local
2. congelar código
3. actualizar este checkpoint
4. commit autorizado
5. push autorizado
6. verificar Contabo read-only
7. backup producción verificable
8. obtener esquema real producción
9. comparar esquema local/producción
10. determinar migraciones realmente pendientes
11. aplicar sólo migraciones autorizadas
12. post-check
13. smoke tests
14. rollback preparado
```

---

## 21. Próximo objetivo operativo

```text
1. Properties QA funcional CERRADA
2. conservar 006–008 como baseline local
3. preparar checkpoint Git limpio y revisable
4. pedir autorización para commit/push
5. subir baseline real a GitHub
6. Codex Cloud: Public Site contra /api/public/listings
7. Codex Cloud: simplificación UI Properties sin cambiar BD
8. probar ramas Codex en worktrees locales separados
9. tests determinísticos + QA humana
10. merge sólo con autorización
```

---

## 22. Continuidad entre chats/agentes

Siempre comenzar leyendo:

```text
docs/ADEIN_ARCHITECTURE.md
docs/ADEIN_CURRENT_STATE.md
```

Después:

- verificar sólo datos susceptibles de haber cambiado;
- no repetir auditorías ya PASS;
- no reconstruir arquitectura desde memoria;
- no asumir que un estado histórico sigue vigente;
- usar Git/Docker/MariaDB como evidencia determinística.

---

## 23. Restricciones actuales

```text
NO_DROP
NO_TRUNCATE
NO_RESET_DESTRUCTIVO
NO_CLEAN_DESTRUCTIVO
NO_DB_PROD_WRITE
NO_PROD_DEPLOY
NO_PUSH
NO_MERGE
NO_LIA_WRITE
```

Todo lo anterior requiere autorización explícita cuando corresponda.

# v071 · CRM Prospect Staging Same-Origin Read-Only Snapshot

## Objetivo
Agregar una capa server-side opcional para staging que sirva `dist` y exponga la ruta same-origin:

- `GET /api/crm/prospect-staging/readonly-snapshot`

Sin exponer públicamente `127.0.0.1:3091` ni conectar navegador directamente a MariaDB.

## Scripts
- `npm run crm:prospect-staging:same-origin-readonly-snapshot`
- `npm run crm:prospect-staging:same-origin-readonly-snapshot:self-check`

## Gates obligatorios para modo real
El servidor **no arranca por defecto**. Solo arranca si:

- `ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071=1`
- `ADEIN_DB_TARGET=staging`
- `ADEIN_SAME_ORIGIN_BIND_HOST=127.0.0.1` (o `0.0.0.0` solo en staging controlado)
- `ADEIN_SAME_ORIGIN_PORT=3016` (o puerto de prueba)
- `ADEIN_UPSTREAM_READONLY_API=http://127.0.0.1:3091/api/crm/prospect-staging/readonly-snapshot`

## Seguridad aplicada
- Solo permite `GET`.
- `POST/PUT/PATCH/DELETE` => `405`.
- Rutas peligrosas (`/write`, `/commit`, `/rollback`, `/admin`, `/delete`, `/production`) => `404`.
- Valida respuesta upstream read-only:
  - `readonly === true`
  - `writeExecuted === false`
  - `commitExecuted === false`
  - `transactionStarted === false` (si existe)
  - `productionTouched === false`
- Si upstream falla/inválido => `503` JSON seguro.

## Integración frontend (opcional)
Para consumir bridge same-origin en build de staging:

- `VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot`

Por defecto puede quedar vacío y se mantiene fallback local v070.

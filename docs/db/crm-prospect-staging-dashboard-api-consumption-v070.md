# v070 · CRM Prospect Staging Dashboard API Consumption (read-only + fallback)

## Objetivo
Preparar el Owner Dashboard para consumir snapshot read-only vía bridge/API controlado cuando exista un endpoint server-side seguro, manteniendo fallback local si no existe endpoint configurable.

## Seguridad aplicada
- Sin conexión frontend directa a MariaDB.
- Sin credenciales en frontend.
- Sin hardcode activo a `127.0.0.1:3091`.
- Endpoint opcional por runtime config: `globalThis.__ADEIN_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL__` (vacío por defecto).
- Fetch con timeout, `credentials: "omit"` y fallback seguro.
- UI mantiene estado explícito: read-only, sin escritura, sin producción y estado bridge.

## UI esperada
En Owner Dashboard:
- Read-only API bridge: Preparado · Controlado · Sin escritura · Sin producción.
- Estado de consumo:
  - `Snapshot API disponible` (si endpoint configurable responde snapshot válido)
  - `Fallback local activo` (si no hay endpoint o falla)

## Validación
- `npm run crm:prospect-staging:readonly-api-bridge`
- `npm run crm:prospect-staging:readonly-api-bridge:self-check`
- `npm run crm:prospect-staging:dashboard-api-consumption:self-check`
- `npm run build`

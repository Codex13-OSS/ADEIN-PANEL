# CRM Prospect Staging Read-Only API Bridge v069

## Qué hace v069
- Prepara un puente API read-only server-side para consumir snapshot controlado sin conexión directa navegador → MariaDB.
- Mantiene `dry-run` como modo por defecto.
- Define contrato JSON estable para bridge, snapshot y evidencia.
- Define rutas permitidas:
  - `GET /health`
  - `GET /api/crm/prospect-staging/readonly-snapshot`
  - `GET /api/crm/prospect-staging/readonly-evidence`

## Qué NO hace v069
- No conecta BD por defecto.
- No escribe ni hace commit.
- No arranca servidor real por defecto desde el script principal del bridge.
- No expone credenciales al frontend.
- No conecta navegador directo a MariaDB.
- No toca PM2/producción/puerto 3006.

## Server local / gated / read-only
Script: `scripts/crm-prospect-staging-readonly-api-server-v069.mjs`

- Solo responde `GET` (`OPTIONS` para CORS preflight).
- Cualquier método no GET responde `405`.
- Rutas desconocidas responden `404`.
- Abort si detecta producción:
  - `NODE_ENV=production`
  - `ADEIN_DB_TARGET=production`
- Bind por defecto en `127.0.0.1`.
- CORS limitado a orígenes explícitos (sin wildcard).

## Gates para modo controlled
Se activa solo con todos:
- `ADEIN_CRM_PROSPECT_STAGING_READONLY_API_V069=1`
- `ADEIN_DB_ENV_FILE=<path>`
- `ADEIN_DB_TARGET=staging`
- `ADEIN_DB_READONLY_API=1`
- `ADEIN_API_BIND_HOST=127.0.0.1`
- `ADEIN_API_PORT=3091`

En modo controlled reutiliza lógica de snapshot v068 (SELECT/COUNT read-only).

## Validación local (Codex)
Ejecutar únicamente:
1. `npm run crm:prospect-staging:readonly-api-bridge`
2. `npm run crm:prospect-staging:readonly-api-bridge:self-check`
3. `npm run build`
4. `git status --short`

Sin credenciales, sin BD real, sin PM2.

## Relación con v068 aprobado
- v068 ya validó snapshot read-only real controlado en staging.
- v069 no reemplaza esa evidencia; agrega capa API bridge segura y preparada para integración posterior de dashboard.

## Cómo se probará después en Contabo staging
1. Configurar gates controlled completos.
2. Levantar server únicamente en `127.0.0.1:3091`.
3. Consumir endpoint `/api/crm/prospect-staging/readonly-snapshot` desde capa server/proxy controlada de staging.
4. Verificar evidencia `/api/crm/prospect-staging/readonly-evidence`.
5. Confirmar que no hay escrituras, commits ni rutas write-like.

## Abort conditions
- Cualquier señal de producción.
- Cualquier intento de método write-like.
- Cualquier cambio fuera de contrato read-only.

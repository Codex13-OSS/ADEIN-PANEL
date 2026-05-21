# v030 - API local read-only para health, metrics y snapshot

## Objetivo
v030 agrega una API local/controlada en Node.js para exponer datos read-only desde MariaDB mediante endpoints JSON.

- **No usa IA**.
- **No integra OpenAI**.
- **No ejecuta escrituras**.

## Comando de arranque
```bash
npm run db:api:readonly
```

Por defecto arranca en:
- Host: `127.0.0.1`
- Port: `3090`

Override opcional:
- `ADEIN_DB_API_HOST`
- `ADEIN_DB_API_PORT`

## Endpoints
- `GET /health`
- `GET /`
- `GET /api/db/health`
- `GET /api/db/metrics`
- `GET /api/db/snapshot`

Reglas:
- Cualquier método distinto de `GET` responde `405`.
- Ruta desconocida responde `404`.
- Todas las respuestas incluyen `mode: "read_only"` y `writesEnabled: false`.

## Auto-testeo
```bash
npm run db:api:self-check
```

Valida:
- arranque del servidor en puerto de test;
- `GET /health`;
- `GET /`;
- `404` en ruta inexistente;
- `405` en métodos no permitidos (`POST /health`, `POST /api/db/snapshot`);
- endpoints DB (`/api/db/health`, `/api/db/metrics`, `/api/db/snapshot`) cuando existen variables de entorno DB;
- validación explícita de `writesEnabled !== true` en respuestas.

Si faltan variables de DB, los checks DB se marcan como `skipped` sin hardcodear credenciales.

## Variables de BD
Se reutilizan las mismas variables de v025-v029:
- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_NAME`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`

## Seguridad y alcance
- API server-side (Node), sin conexión directa navegador → MariaDB.
- Runtime read-only con consultas `SELECT`.
- Sin migraciones.
- Sin escrituras en tablas.
- Sin conexión automática del frontend en esta fase.

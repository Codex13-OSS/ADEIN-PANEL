# CRM Prospect Staging Read-Only API Bridge v069.1

## Qué falló en v069
En v069, el script `scripts/crm-prospect-staging-readonly-api-server-v069.mjs` era seguro pero quedaba en modo carga/dry-run cuando se ejecutaba directo por npm. Eso imprimía contrato JSON, pero no levantaba listener HTTP.

Resultado: los `curl` a `127.0.0.1:3091` fallaban con `Connection refused`.

## Por qué falló de forma segura
El comportamiento fue fail-safe:
- no se abrió puerto,
- no hubo conexión BD,
- no hubo credenciales,
- no hubo escritura ni commit,
- no se tocó producción.

## Cambio v069.1
Ahora el mismo script conserva doble modo seguro:

1. **Importado como módulo**
   - No arranca automáticamente.
   - Exporta `startReadonlyApiServer` y `createReadonlyApiServer`.

2. **Ejecutado directo (npm script `crm:prospect-staging:readonly-api-server`)**
   - Arranca server mock/local explícitamente.
   - Bind por defecto: `127.0.0.1` (`ADEIN_API_BIND_HOST` opcional).
   - Puerto por defecto: `3091` (`ADEIN_API_PORT` opcional).
   - Imprime JSON de arranque con:
     - `ok:true`
     - `mode:"mock_readonly_api_server"`
     - `serverStarted:true`
     - `databaseConnectionAttempted:false`
     - `readonly:true`
     - `writeExecuted:false`
     - `commitExecuted:false`
     - `productionTouched:false`
     - `bindHost`, `port`, `routes`

## Rutas validadas (mock/local)
- `GET /health` → `200` + estado read-only sin BD.
- `GET /api/crm/prospect-staging/readonly-snapshot` → `200` + snapshot fallback/mock compatible v068 (`dashboardPayloadPreview`).
- `GET /api/crm/prospect-staging/readonly-evidence` → `200` + evidencia:
  - `verifiedNoTransaction:true`
  - `verifiedNoWrite:true`
  - `verifiedNoCommit:true`
  - `targetDatabase:"none_mock"`
  - `databaseConnectionAttempted:false`

Reglas de manejo:
- no-GET → `405`
- ruta desconocida → `404`

## Seguridad y abort conditions
Abort explícito si:
- `NODE_ENV=production`
- `ADEIN_DB_TARGET=production`
- `ADEIN_DB_ENV=production`

Adicionalmente:
- no lectura de `ADEIN_DB_ENV_FILE` por defecto en mock/local,
- no SQL ejecutable en server mock/local,
- CORS acotado (sin wildcard de producción),
- sin rutas write/admin/commit/rollback.

## Validación local / server (sin BD real)
1. `npm run crm:prospect-staging:readonly-api-bridge`
2. `npm run crm:prospect-staging:readonly-api-bridge:self-check`
3. `npm run build`
4. `git status --short`

El self-check v069 verifica contrato dry-run bridge, arranque controlado del mock server en puerto efímero, respuestas 200/405/404, abort de producción y ausencia de patrones inseguros.

## Alcance vs siguiente paso
v069.1 solo cubre **arranque explícito mock/local read-only** para validación segura.

El modo **controlled read-only con BD real** queda para un paso posterior separado, con gates explícitos y fuera de este hotfix.

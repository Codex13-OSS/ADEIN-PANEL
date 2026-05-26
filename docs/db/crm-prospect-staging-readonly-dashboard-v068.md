# CRM Prospect Staging Read-Only Dashboard v068

## Objetivo
v068 agrega una capa **read-only** para construir un snapshot/payload de dashboard de prospect staging sin escribir datos.

## Qué hace
- Agrega `scripts/crm-prospect-staging-readonly-dashboard-v068.mjs` con:
  - `dry_run` por defecto (sin conexión a BD, sin transacción, sin escritura).
  - `controlled_readonly_dashboard_snapshot` con gates explícitos y solo `SELECT/COUNT`.
- Agrega `scripts/crm-prospect-staging-readonly-dashboard-self-check-v068.mjs` para validar contrato/safety sin BD real.
- Agrega `src/lib/crmProspectStagingReadonlySnapshot.ts` para normalizar payloads y fallback seguro para Owner Dashboard.
- Integra un bloque compacto en Owner Dashboard para estado de readiness de “Prospectos staging / lectura controlada”.

## Qué NO hace
- No conecta frontend a BD real automáticamente.
- No ejecuta INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE/CREATE/REPLACE.
- No inicia transacción ni hace COMMIT.
- No usa producción.
- No usa APIs externas (OpenAI/Facebook/WhatsApp real).

## Rationale de seguridad read-only
- Modo por defecto es dry-run.
- Controlled mode requiere gates exactos:
  - `ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068=1`
  - `ADEIN_DB_ENV_FILE=<path>`
  - `ADEIN_DB_TARGET=staging`
  - `ADEIN_DB_READONLY_DASHBOARD=1`
- Abort automático en señales de producción o escritura.

## Ejecución local (Codex/local)
```bash
npm run crm:prospect-staging:readonly-dashboard
npm run crm:prospect-staging:readonly-dashboard:self-check
```

## Controlled read-only snapshot (solo staging, fuera de Codex/local)
```bash
ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068=1 \
ADEIN_DB_ENV_FILE=/ruta/.env.staging \
ADEIN_DB_TARGET=staging \
ADEIN_DB_READONLY_DASHBOARD=1 \
node scripts/crm-prospect-staging-readonly-dashboard-v068.mjs
```

## Métricas entregadas
- Summary cards:
  - totalProspects
  - totalConversations
  - totalAnalyses
  - totalFollowups
  - totalHistoryEvents
  - syntheticRowsDetected
- latestProspects (max 10)
- followups (max 10)
- historyEvents (max 10)
- sourceBreakdown por source/review_status/status/intention_level

## Relación con v067.1
v068 consume el contexto del set sintético persistido de v067.1 y detecta filas sintéticas/demo por `is_test`, `is_demo`, `external_ref`, `source_ref`, `source_code`, `event_type` (incluyendo patrón `v067`).

## Abort conditions
- `NODE_ENV=production`
- `ADEIN_DB_TARGET=production`
- `ADEIN_DB_ENV=production`
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_WRITE_GATE` definido
- `ADEIN_DB_APPROVAL_TOKEN` definido
- tablas faltantes
- queries con keywords SQL peligrosas

## Evidencia esperada
El output JSON incluye `readonlyEvidence` con:
- `verifiedNoTransaction: true`
- `verifiedNoWrite: true`
- `verifiedNoCommit: true`
- `forbiddenDestinationsConfirmed: true`
- `queriesExecuted` (solo SELECT/COUNT)
- `targetDatabase: "staging"`

## Confirmación de alcance
v068 no introduce datos reales nuevos, no prospectos reales de campaña y no toca producción.

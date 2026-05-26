# v067 - CRM Prospect Staging Synthetic Persistent Write (Controlled)

## Qué hace
Prepara el primer flujo de escritura persistente **sintética** para staging en 6 tablas: `lead_sources`, `prospects`, `whatsapp_conversations`, `whatsapp_analyses`, `prospect_followups`, `crm_history_events`.

## Qué NO hace
- No escribe por defecto.
- No conecta BD por defecto.
- No ejecuta transacción/COMMIT por defecto.
- No usa datos reales.
- No toca producción.

## Modos
1. `dry_run` (default): contrato JSON + plan de commit/rollback sintético en memoria.
2. `controlled_readonly_precommit`: requiere gates readonly y solo hace SELECT/COUNT en staging.
3. `controlled_persistent_commit_staging`: preparado con gates exactos para insertar 1 set sintético relacional y verificar +1 por tabla.

## Gates exactos para commit
- `ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067=1`
- `ADEIN_DB_ENV_FILE` definido
- `ADEIN_DB_TARGET=staging`
- `ADEIN_DB_WRITE_GATE=PERSISTENT_COMMIT_V067`
- `ADEIN_DB_APPROVAL_TOKEN=APPROVE_SYNTHETIC_PERSISTENT_WRITE_V067`
- `ADEIN_DB_SYNTHETIC_ONLY=1`
- `ADEIN_DB_PRODUCTION_TOUCHED=0`

## Evidencia esperada
- Antes: `rowCountsBefore` en las 6 tablas.
- Durante: filas por token verificables en transacción.
- Después: `rowCountsAfterCommit = rowCountsBefore + 1` por tabla.

## Rollback compensatorio por token
Script: `scripts/crm-prospect-staging-synthetic-persistent-write-rollback-v067.mjs`.
Orden seguro: `crm_history_events` -> `prospect_followups` -> `whatsapp_analyses` -> `whatsapp_conversations` -> `prospects` -> `lead_sources`.

## Abort conditions
Se aborta en señales de producción, gates incompletos/incorrectos, tablas faltantes, intentos de escribir destino prohibido (`clients/contracts/payment_schedule/lots`) o verificación post-commit inválida.

## Confirmaciones de seguridad
- Solo sintético, sin datos reales ni prospectos reales.
- Sin OpenAI/IA real, Facebook API ni WhatsApp API real.
- En local/Codex: ejecutar solo `dry-run`, `self-check`, `build`.

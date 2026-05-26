# v065 — CRM Prospect Staging Synthetic Write Rehearsal

## Qué hace
- Implementa un ensayo de escritura sintética relacional para `lead_sources`, `prospects`, `whatsapp_conversations`, `whatsapp_analyses`, `prospect_followups`, `crm_history_events`.
- Por defecto corre en **dry-run** y no abre conexión a BD.
- En modo controlado (con gates completos) ejecuta inserciones sintéticas dentro de transacción y termina con `ROLLBACK` obligatorio.

## Qué NO hace
- No hace `COMMIT`.
- No permite persistencia real.
- No usa datos reales de prospectos.
- No toca producción.
- No usa OpenAI/IA, Facebook API, ni WhatsApp API real.
- No escribe en `clients`, `contracts`, `payment_schedule`, `lots`.

## Dry-run (default)
Comando:
```bash
npm run crm:prospect-staging:synthetic-write
```
Resultado esperado:
- `mode: "dry_run"`
- `databaseConnectionAttempted: false`
- `transactionStarted: false`
- `rollbackExecuted: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`
- `syntheticOnly: true`

## Rollback-only staging (controlado)
Gates requeridos exactos:
- `ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_WRITE_V065=1`
- `ADEIN_DB_ENV_FILE` definido
- `ADEIN_DB_TARGET=staging`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V065`

Flujo:
1. Valida señales de seguridad y aborta en condiciones peligrosas.
2. Conecta solo a staging.
3. Verifica existencia de las 6 tablas.
4. Captura row counts previos.
5. Inicia transacción.
6. Inserta exactamente 1 set sintético relacional (6 inserts).
7. Verifica existencia del token dentro de transacción.
8. Ejecuta `ROLLBACK` obligatorio.
9. Verifica que row counts post-rollback == row counts before.

## Abort conditions
- `NODE_ENV=production`
- `ADEIN_DB_TARGET=production`
- `ADEIN_DB_ENV=production`
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_WRITE_GATE` distinto de `ROLLBACK_ONLY_V065`
- gates incompletos
- faltan tablas prospect staging
- row counts post-rollback distintos a row counts before
- detección de destino prohibido (`clients/contracts/payment_schedule/lots`)

## Evidencia esperada y validación de no persistencia
- JSON con `rollbackExecuted: true`, `commitExecuted: false`, `persistentWriteExecuted: false`.
- `postRollbackVerified: true`.
- `rowCountsAfterRollback` iguales a `rowCountsBefore`.

## Self-check
Comando:
```bash
npm run crm:prospect-staging:synthetic-write:self-check
```
Valida contrato JSON, dry-run seguro, rechazo de entornos peligrosos, bloqueo sin gates completos y ausencia de patrón COMMIT ejecutable.

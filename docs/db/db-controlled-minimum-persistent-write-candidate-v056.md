# v056 — Controlled Minimum Persistent Write Candidate

## Propósito
Preparar el **candidate/rehearsal** de la primera escritura mínima persistente controlada, sin ejecutar escrituras reales ni COMMIT en esta fase.

## Alcance de v056
- Script principal: `npm run db:controlled-minimum-write:candidate`
- Self-check: `npm run db:controlled-minimum-write:candidate:self-check`
- Solo planeación/control de candidate artifact en JSON.

## Garantías de seguridad en v056
- No hay escritura persistente real.
- No hay COMMIT.
- Solo datos sintéticos/controlados como plan futuro.
- `dryRun: true` por defecto.
- `candidateOnly: true` por defecto.

## Tablas permitidas (candidate plan)
- `properties`
- `lots`
- `clients`
- `contracts`
- `payment_schedule`

## Tablas prohibidas en v056
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`
- cualquier tabla no listada como permitida

## Artifact esperado
Incluye:
- `baseCheckpoint.tag`: `v0.1.46-adein-crm-prewrite-approval-gate`
- `baseCheckpoint.expectedHead`: `5e09e5b`
- `requiredBackup.path`: `/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql`
- `requiredBackup.expectedSha256`: `3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d`
- row counts requeridos en 0 para: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`
- plan relacional sintético mínimo y secuencia de ejecución con rollback por defecto

## Approval gate futuro (bloqueado en v056)
- `humanApprovalRequired: true`
- token futuro: `APPROVE_V056_MINIMUM_SYNTHETIC_PERSISTENT_WRITE`
- en v056, si el token se pasa, **se rechaza**
- `commitStillBlocked: true`

## Criterios de aborto
- backup faltante
- SHA256 del backup no coincide
- row counts no están todos en cero
- falta env file cuando se pide modo controlado
- intento de tocar puerto de producción
- detección de datos reales
- detección de variables de commit fuera de fase permitida
- schema mismatch
- solicitud de tablas fuera de lista permitida

## Modo opcional controlled read-only
Variables:
- `ADEIN_V056_CONTROLLED_READONLY=1`
- `ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env`

En este modo:
- puede validar existencia de env file y backup + sha
- sigue sin INSERT/UPDATE/DELETE
- sin transacción de escritura
- sin COMMIT

## Comandos de validación
```bash
npm run db:controlled-minimum-write:candidate
npm run db:controlled-minimum-write:candidate:self-check
npm run build
```

## Siguiente fase sugerida
Rehearsal transaccional **rollback-only** controlado en servidor antes de cualquier COMMIT persistente futuro.

## v056.1 — Controlled Read-Only Row Counts Evidence Fix

### Razón del patch
En v056 el modo controlled read-only verificaba env/backup/SHA, pero dejaba `controlledReadonlyChecks.rowCountsVerified:false` sin evidencia de conteos reales en BD. Este patch agrega esa evidencia mínima requerida para avanzar a v057.

### Cambio funcional en controlled read-only
Con:
- `ADEIN_V056_CONTROLLED_READONLY=1`
- `ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env`

el script ahora:
1. Carga el env file externo sin imprimir secretos.
2. Verifica backup v054 (`exists:true` y `sha256Matches:true`).
3. Intenta conexión de solo lectura a MariaDB (mysql2/promise).
4. Ejecuta únicamente `SELECT COUNT(*) AS count FROM `<tablaPermitida>`` sobre:
   - `clients`
   - `properties`
   - `lots`
   - `contracts`
   - `payment_schedule`

### Motor y compatibilidad
- BD real objetivo: MariaDB (`adein_crm`).
- Verificación read-only implementada con `mysql2/promise`.
- No usa `psql` ni sintaxis PostgreSQL.
- Usa variables `ADEIN_DB_HOST`, `ADEIN_DB_PORT`, `ADEIN_DB_USER`, `ADEIN_DB_PASSWORD`, `ADEIN_DB_NAME` cargadas desde `ADEIN_DB_ENV_FILE`.
- Si falta alguna variable `ADEIN_DB_*` requerida, aborta con `ok:false` sin imprimir secretos.

### Nuevos campos de artifact
- `actualCurrentRowCounts`
- `rowCountsMatchExpected`
- `expectedRowCountTables`
- `controlledReadonlyChecks.rowCountsVerified:true` (solo cuando todas las tablas existen y los conteos coinciden con `requiredCurrentRowCountsBeforeWrite`)

### Criterios de fallo (ok:false + exit code 1)
- Falta `ADEIN_DB_ENV_FILE` o el archivo no existe.
- Backup requerido inexistente.
- SHA256 del backup no coincide.
- Falla la conexión de lectura a BD.
- Falta alguna tabla objetivo o falla el `SELECT COUNT(*)`.
- Algún conteo difiere de `requiredCurrentRowCountsBeforeWrite` (cero en todas las tablas requeridas).

En todos los casos de fallo se incluye `abortReason` claro y, cuando existe, `actualCurrentRowCounts`.

### Comando de validación en servidor
```bash
ADEIN_V056_CONTROLLED_READONLY=1 \
ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env \
npm run db:controlled-minimum-write:candidate
```

### Garantías que se mantienen
- Sin INSERT/UPDATE/DELETE.
- Sin transacción de escritura.
- Sin COMMIT.
- Sin migraciones.
- `writesEnabled:false`, `commitAllowed:false`, `commitExecuted:false`, `persistentWriteExecuted:false`.

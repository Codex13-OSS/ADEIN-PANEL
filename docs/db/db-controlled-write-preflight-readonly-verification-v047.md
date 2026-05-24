# v047 — Server-Side Controlled Preflight Read-Only Backup/Snapshot Verification

## Objetivo
La fase **v047** agrega una verificación server-side, controlada y **read-only** previa a cualquier escritura persistente futura. Esta fase valida que exista preparación verificable para backup/snapshots, mantiene evidencia JSON por stdout y bloquea gates peligrosos de escritura.

## Relación con v042-v046
- **v042-v043**: reforzaron controles de rollback y evidencia.
- **v044-v045**: introdujeron protocolo/aprobación y dry-run controlado.
- **v046**: generó artifact de approval/preflight en memoria.
- **v047 (esta fase)**: agrega verificación read-only server-side para preparar **v048** sin ejecutar escritura real.

## Qué valida
- Metadatos de fase y modo `server_side_readonly_preflight_verification`.
- `dryRun=true`, `readOnly=true`, `commitAllowed=false`.
- Scope estricto de tablas de negocio:
  - In scope: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.
  - Bloqueadas: `crm_users`, `sellers`, `crm_followups`, `import_batches`, `import_raw_rows`, `migration_plans`, `migration_plan_events`, `audit_log`.
- Referencias opcionales sanitizadas para:
  - `ADEIN_BACKUP_REFERENCE`
  - `ADEIN_SNAPSHOT_BEFORE_REFERENCE`
  - `ADEIN_SNAPSHOT_AFTER_REFERENCE`
- Evidencia JSON imprimible en stdout.

## Qué NO hace
- No ejecuta escritura real.
- No ejecuta COMMIT.
- No promueve datos a tablas de negocio.
- No conecta UI/dashboard.
- No requiere conexión obligatoria a BD.
- No imprime datos reales de backup/snapshot.
- No imprime credenciales.

## Scripts npm
- `npm run db:controlled-write:preflight:readonly-verification`
- `npm run db:controlled-write:preflight:readonly-verification:self-check`

## Output esperado (principal)
Campos clave del JSON:
- `ok`, `phase`, `mode`
- `dryRun`, `readOnly`
- `commitAllowed`, `commitExecuted`
- `persistentWriteExecuted`, `realWriteAuthorized`
- `backupVerificationRequired`, `backupVerificationAttempted`, `backupVerified`
- `snapshotBeforeRequired`, `snapshotBeforeVerificationAttempted`, `snapshotBeforeVerified`
- `snapshotAfterRequired`, `snapshotAfterVerificationAttempted`, `snapshotAfterVerified`
- `tablesInScope`, `tablesBlocked`, `readOnlyChecks`, `abortConditions`
- `nextRecommendedPhase=v048-controlled-real-write-rehearsal-with-explicit-approval`

## Variables opcionales
- `ADEIN_BACKUP_REFERENCE`
- `ADEIN_SNAPSHOT_BEFORE_REFERENCE`
- `ADEIN_SNAPSHOT_AFTER_REFERENCE`

Si no están presentes:
- La fase sigue con `ok=true`.
- Se marca verificación como `attempted=false` y `verified=false` (pendiente), sin fallar.

## Gates peligrosos bloqueados
Si se detecta cualquiera de estos valores, el script aborta con exit code 1 y JSON parseable:
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_WRITE_GATE=REAL_COMMIT`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_MODE=write`
- `ADEIN_DB_MODE=read_write`

## Cómo correr localmente (read-only)
1. `npm run db:controlled-write:preflight:readonly-verification`
2. `npm run db:controlled-write:preflight:readonly-verification:self-check`

## Cómo correr en servidor (read-only)
- Ejecutar los mismos comandos en entorno sin habilitar gates de escritura.
- Si se proveen referencias de backup/snapshot, sólo se usan como evidencia sanitizada.
- No se realiza lectura de contenido de backups ni escritura persistente.

## Criterios para cerrar v047
- Script principal devuelve JSON parseable con `ok=true` en modo normal.
- Self-check pasa aserciones positivas.
- Self-check rechaza todos los casos negativos de gates peligrosos.
- Evidencia read-only disponible por stdout.

## Siguiente fase recomendada
- `v048-controlled-real-write-rehearsal-with-explicit-approval`.

## Aclaraciones explícitas de seguridad
- Sin escritura real.
- Sin COMMIT.
- Sin datos reales en stdout.
- Sin credenciales.
- Sin conexión UI/dashboard en esta fase.

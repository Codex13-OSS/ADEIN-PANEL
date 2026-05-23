# ADEIN CRM — Controlled Write Preflight v046

## Objetivo
Implementar una fase técnica de **preparación y validación previa** a cualquier escritura persistente real, generando un **approval artifact** estructurado y verificable, manteniendo bloqueo total de commit real y de persistencia.

## Relación con v042, v043, v044 y v045
- **v042** validó ejecución controlada en rollback-only.
- **v043** consolidó evidencia de readiness sin habilitar persistencia.
- **v044** formalizó plan y protocolo de aprobación.
- **v045** implementó dry-run controlado con scope y validaciones técnicas.
- **v046** añade preflight de aprobación con artefacto técnico y requerimientos explícitos de backup/snapshots, todavía sin escritura real.

## Qué implementa
- Script principal `scripts/db-controlled-write-preflight.mjs`.
- Modo por defecto `preflight_dry_run`.
- Generación en memoria de un **approval artifact** en JSON por `stdout`.
- Validaciones de preflight críticas (metadata de fase, dry-run previo requerido, backup/snapshots/human approval requeridos).
- Rechazo explícito de variables peligrosas asociadas a commit real o escritura persistente.
- Self-check `scripts/db-controlled-write-preflight-self-check.mjs` con assertions positivas y negativas.

## Qué NO implementa
- No escritura persistente real.
- No `connection.commit()` ni `.commit()`.
- No conexión obligatoria a base de datos.
- No cambios de schema SQL.
- No datos reales.
- No credenciales.
- No OpenAI/IA.
- No integración UI/frontend/auth/login/mobile/documentos con escritura.

## Scripts npm agregados
- `db:controlled-write:preflight`
- `db:controlled-write:preflight:self-check`

## Modo preflight_dry_run por defecto
- `mode: "preflight_dry_run"`
- `dryRun: true`

## Commit real bloqueado
- `commitAllowed: false`
- `commitExecuted: false`

## Escritura persistente no autorizada
- `persistentWriteExecuted: false`
- `realWriteAuthorized: false`

## Artefacto de aprobación
El script principal produce un artefacto en JSON con:
- Estado de fase y modo.
- Gates técnicos preflight.
- Condiciones de aborto.
- Template de evidencia para fase posterior.

## Requisitos de backup
- `backupVerificationRequired: true`
- `backupVerified: false` (en v046 solo preflight)

## Requisitos de snapshot antes/después
- `snapshotBeforeRequired: true`
- `snapshotAfterRequired: true`

## Requisitos de aprobación humana
- `humanApprovalRequired: true`
- `requiredHumanApprovalText` obligatorio y no vacío.

## Tablas candidatas
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas bloqueadas
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Variables peligrosas rechazadas
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_WRITE_GATE=REAL_COMMIT`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`

Cualquier señal equivalente de habilitación de commit/persistencia debe resultar en rechazo (`exit code 1`).

## Output esperado (campos clave)
- `ok`
- `phase: "v046"`
- `mode: "preflight_dry_run"`
- `dryRun: true`
- `commitAllowed: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`
- `realWriteAuthorized: false`
- `approvalArtifactGenerated: true`
- `backupVerificationRequired: true`
- `backupVerified: false`
- `snapshotBeforeRequired: true`
- `snapshotAfterRequired: true`
- `humanApprovalRequired: true`
- `requiredHumanApprovalText`
- `tablesInScope`
- `tablesBlocked`
- `preflightChecks`
- `abortConditions`
- `evidenceTemplate`
- `nextRecommendedPhase`

## Self-check
El self-check valida:
1. Ejecución positiva con assertions de seguridad y contrato de salida.
2. Casos negativos con variables peligrosas (`ADEIN_DB_COMMIT=1`, `ADEIN_DB_WRITE_GATE=REAL_COMMIT`, `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`) y rechazo obligatorio.
3. Exit code 0 solo si todo pasa.

## Criterios de aceptación
- Script principal y self-check ejecutan correctamente.
- Build del proyecto pasa.
- No commit real ni escritura persistente.
- No conexión obligatoria a BD.
- Scope de tablas respetado.
- Sin credenciales ni datos reales.

## Riesgos mitigados
- Persistencia accidental por variables de entorno: mitigada por bloqueo explícito.
- Scope drift: mitigado por listas cerradas de tablas permitidas/bloqueadas.
- Aprobación incompleta: mitigada por `requiredHumanApprovalText` y checks críticos.
- Evidencia insuficiente: mitigada por `evidenceTemplate` y `abortConditions`.

## Qué sigue
**v047** podría implementar preflight server-side con verificación read-only real de backup/snapshot (sin escritura persistente real), o una fase de aprobación manual reforzada previa al primer commit controlado.

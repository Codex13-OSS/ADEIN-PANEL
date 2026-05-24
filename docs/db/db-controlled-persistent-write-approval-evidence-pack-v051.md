# v051 — Controlled Persistent Write Approval Artifact / Pre-Commit Evidence Pack

## ¿Qué implementa v051?

La fase **v051** implementa un artefacto de evidencia previo a commit real llamado **Pre-Commit Evidence Pack**.

- Genera una salida JSON estructurada para revisión humana.
- Declara checkpoints base (v042 → v050).
- Define checklist de evidencia requerida para una fase futura de commit controlado.
- Define tablas permitidas/prohibidas y condiciones de aborto.
- Mantiene el proceso en modo **evidence-only** (sin escritura persistente).

## ¿Por qué v051 todavía NO hace escritura persistente?

Porque su propósito es **preparar y formalizar evidencia**, no ejecutar cambios reales. En v051:

- Commit real está hard-disabled.
- Escrituras persistentes están hard-disabled.
- Conexión a DB está desactivada por defecto.
- No se aceptan señales de ejecución real (gates peligrosos).

Si se detecta cualquier señal de commit/escritura real, el script principal responde con JSON válido, `ok: false`, `blocked: true` y termina con exit code `1`.

## Relación con v042 a v050

v051 referencia explícitamente los hitos previos:

- v042 rollback fixture required columns / rollback-only real approved
- v043 real rollback evidence
- v044 controlled write approval protocol
- v045 controlled write dry-run
- v046 controlled write preflight
- v047 readonly verification
- v048 controlled real write rehearsal
- v049 persistent write candidate
- v050 minimum safe commit rehearsal

v051 **no reemplaza** esas fases: las usa como base de contexto de seguridad y agrega el artefacto de aprobación/evidencia previo a una fase futura explícita.

## Evidencia que prepara antes de cualquier prueba real

La fase define el checklist futuro mínimo:

- repoClean
- stableTagConfirmed
- serverBackupConfirmed
- databaseSnapshotConfirmed
- beforeRowCountsCaptured
- allowedTablesConfirmed
- forbiddenTablesConfirmed
- rollbackPlanConfirmed
- abortPlanConfirmed
- humanApprovalConfirmed
- approvalTokenPrepared
- afterRowCountsProcedureDefined
- evidenceOutputPathDefined

## Gates futuros (NO autorizan commit en v051)

Se listan como referencia para fase posterior, pero en v051 **no autorizan nada**:

- ADEIN_DB_ALLOW_PERSISTENT_WRITE
- ADEIN_DB_WRITE_GATE
- ADEIN_DB_APPROVAL_TOKEN
- ADEIN_DB_COMMIT
- ADEIN_DB_BACKUP_CONFIRMED
- ADEIN_DB_SNAPSHOT_CONFIRMED
- ADEIN_DB_ROW_COUNTS_CONFIRMED

## ¿Qué está prohibido en v051?

- Escritura persistente real.
- Commit real.
- Modo `write` o `read_write`.
- Cualquier intento de operar fuera de `allowedTables`.
- Cualquier intento de tocar tablas prohibidas.
- Uso de datos reales.
- Uso o solicitud de credenciales.

## Ejecución

```bash
npm run db:controlled-write:approval-evidence-pack
npm run db:controlled-write:approval-evidence-pack:self-check
```

## Criterios de aceptación

1. Script principal devuelve JSON válido.
2. Caso por defecto: `ok: true`, `phase: "v051"`, `evidenceOnly: true`, `readOnly: true`, `databaseConnectionRequired: false`, `commitAllowed: false`, `commitExecuted: false`, `persistentWriteExecuted: false`, `validForRealCommit: false`.
3. Casos peligrosos: bloqueados con exit code `1` y JSON válido (`ok: false`, `blocked: true`).
4. `allowedTables` exactamente: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.
5. `approvalArtifact.approved` y `approvalArtifact.validForRealCommit` deben permanecer en `false`.

## Checklist para cerrar v051

- [ ] Script principal creado y operativo.
- [ ] Self-check creado y operativo.
- [ ] Bloqueos de seguridad activos para todas las señales peligrosas definidas.
- [ ] Salida JSON incluye todos los bloques requeridos del Evidence Pack.
- [ ] No hay conexión a DB por defecto.
- [ ] No hay commit ni escritura persistente en v051.
- [ ] Documentación v051 publicada.

## Nota explícita de transición

v051 deja el repositorio listo para que en la **Mac/servidor** se haga `git pull` y, después, se planifique una fase futura explícita de prueba controlada. **v051 no ejecuta escritura real**.

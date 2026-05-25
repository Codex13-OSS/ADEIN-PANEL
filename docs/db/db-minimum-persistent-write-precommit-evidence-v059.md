# v059 — Controlled Minimum Persistent Write Pre-Commit Evidence Pack

## Qué es v059
v059 es una fase de **evidencia pre-commit** para preparar una futura escritura mínima persistente en una fase posterior (v060+), manteniendo en v059 una política estricta de no escritura.

## Evidence-only / Pre-commit-only
- `evidenceOnly: true`
- `preCommitOnly: true`
- `commitAllowed: false`
- `commitAttempted: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`

## Garantías de seguridad en v059
- No ejecuta conexión BD por defecto (artifact-only).
- No abre transacciones.
- No ejecuta SQL de escritura.
- No ejecuta `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE TABLE`.
- No ejecuta COMMIT real.

## Evidencia requerida consolidada
1. **v054 backup**
   - path: `/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql`
   - sha256: `3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d`
2. **v056.1 controlled read-only row counts fix**
   - tag: `v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix`
   - head: `a3dce91`
   - row counts requeridos en 0: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`
3. **v057 controlled transaction rollback rehearsal**
   - tag: `v0.1.48-adein-crm-controlled-transaction-rollback-rehearsal`
   - head: `3eceb82`
   - `rollbackOnlySuccessfulRequired: true`
   - `postRollbackVerifiedRequired: true`
4. **v058 minimum persistent write approval artifact**
   - tag: `v0.1.49-adein-crm-minimum-persistent-write-approval-artifact`
   - head: `2cc088e`
   - `artifactOnlyRequired: true`
   - `commitDisabledRequired: true`

## Modo controlled read-only opcional
Se activa solo con:

```bash
ADEIN_V059_CONTROLLED_READONLY=1 ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env npm run db:minimum-write:precommit-evidence
```

Comportamiento:
- Carga variables desde `ADEIN_DB_ENV_FILE`.
- Verifica existencia y SHA256 del backup v054.
- Abre conexión MariaDB con `mysql2/promise` usando `ADEIN_DB_*`.
- Ejecuta únicamente `SELECT COUNT(*) AS count FROM \`<tabla>\`` para:
  - `clients`
  - `properties`
  - `lots`
  - `contracts`
  - `payment_schedule`
- Exige row counts en 0.
- Cierra conexión.
- Mantiene prohibición total de escritura y commit.

## Variables peligrosas bloqueadas
Si se detecta cualquiera de estas condiciones, el script aborta con JSON válido `ok:false` y exit code `1`:
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_WRITES_ENABLED=true`
- `ADEIN_DB_MODE=write`
- `ADEIN_DB_MODE=read_write`
- `ADEIN_DB_MODE=persistent_write`
- `ADEIN_DB_WRITE_GATE=REAL_COMMIT`
- `ADEIN_DB_WRITE_GATE=V059_REAL_COMMIT`
- `ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT`
- `ADEIN_V059_EXECUTE_COMMIT=1`
- `ADEIN_V059_ALLOW_INSERT=1`
- `ADEIN_V059_OPEN_TRANSACTION=1`

## Cómo correr
```bash
npm run db:minimum-write:precommit-evidence
npm run db:minimum-write:precommit-evidence:self-check
ADEIN_V059_CONTROLLED_READONLY=1 ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env npm run db:minimum-write:precommit-evidence
```

## Qué NO hace v059
- No implementa ruta funcional de commit real.
- No escribe en BD.
- No inserta datos.
- No modifica esquema.
- No migra datos.
- No usa datos reales de cliente.

## Criterios para pasar a v060+
- Autorización humana separada y explícita.
- Verificación fresca de backup.
- Verificación fresca de row counts en 0.
- Evidencia de rollback rehearsal fresca o dependencia explícita de v057.
- Primera ejecución en staging.
- Plan de verificación post-commit en fase futura.

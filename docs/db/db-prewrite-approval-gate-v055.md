# v055 — Pre-Write Approval Gate / Minimum Persistent Write Authorization Pack

## Objetivo
Establecer una compuerta formal de aprobación **previa** a cualquier escritura persistente futura (v056), sin ejecutar escrituras en v055.

## Alcance
- Script principal: `npm run db:prewrite-approval:gate`
- Self-check: `npm run db:prewrite-approval:gate:self-check`
- Solo verificación y artefacto JSON de aprobación humana.

## Dry-run local (por defecto)
```bash
npm run db:prewrite-approval:gate
```
Comportamiento esperado:
- `ok: true`
- `dryRun: true`
- `approvalGateOnly: true`
- sin conexión a BD
- `productionPortTouched: false`
- `productionHealthChecked: false`
- `stagingHealthChecked: false`
- sin SQL de escritura

## Modo controlado read-only (servidor)
Requiere gates explícitos:
```bash
ADEIN_V055_PREWRITE_APPROVAL_GATE=1 \
ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env \
ADEIN_V054_EVIDENCE_JSON=/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/backup_evidence_v054.json \
ADEIN_V054_BACKUP_SQL=/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql \
ADEIN_V054_BACKUP_SHA256=3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d \
npm run db:prewrite-approval:gate
```

En este modo el script puede:
- leer env file sin imprimir secretos,
- conectar a MariaDB en lectura,
- ejecutar `SELECT COUNT(*)` solo sobre:
  - `clients`, `properties`, `lots`, `contracts`, `payment_schedule`,
- validar existencia de evidence JSON + SQL,
- calcular SHA256 del SQL y compararlo,
- revisar salud de `:3006` y `:3016` por HTTP HEAD/GET, marcando `productionHealthChecked/stagingHealthChecked` sin cambiar `productionPortTouched` (permanece `false`).

## Qué valida del backup v054
- existencia de `backup_evidence_v054.json`,
- existencia de `.sql` de backup,
- tamaño del backup,
- hash SHA256 actual vs esperado.

## Qué valida de row counts
Captura conteos actuales read-only para tablas permitidas y los agrega al JSON (`currentRowCounts`).

## Qué NO hace
- No ejecuta `INSERT/UPDATE/DELETE/DDL`.
- No habilita commit.
- No modifica PM2.
- No migra datos.
- No toca schema SQL.

## Artifact de aprobación humana
Incluye:
- `approvalTokenRequired: APPROVE_MINIMUM_PERSISTENT_WRITE_V056`
- obligación de referenciar SHA256, row counts y tablas,
- validez de un solo uso.

## Abort conditions
- Flags peligrosos de escritura detectados.
- Falta de evidencia v054 o SQL.
- SHA256 no coincide.
- Falla conexión/verificación read-only.
- Producción/staging no saludables.

## Rollback plan
- detener ejecución write-capable,
- restaurar desde backup verificado en entorno aislado,
- recalcular row counts,
- requerir nueva aprobación humana.

## Siguiente fase sugerida (v056)
Solo candidate plan, **no ejecutado en v055**:
- escrituras mínimas con datos sintéticos controlados en `clients`, `properties`, `lots`, `contracts`, `payment_schedule`,
- staging primero,
- backup + hash verificados,
- row counts pre y post,
- token exacto y aprobación humana explícita.

# v048 Controlled Real Write Rehearsal with Explicit Approval

## Qué hace v048
- Introduce una capa de ensayo de escritura real controlada.
- El modo por defecto ejecuta dry-run seguro sin conexión a base de datos.
- El modo `rollback_only` solo se habilita con gates explícitos y aprobación humana.
- Si se activa `rollback_only`, intenta inserts sintéticos en `properties`, `clients`, `lots`, `contracts`, `payment_schedule` dentro de transacción rollback-only.

## Qué NO hace
- No hace escritura persistente real.
- No ejecuta commit de transacción.
- No usa datos reales.
- No usa credenciales hardcodeadas.
- No modifica schema SQL.

## Por qué sigue sin escritura persistente
El objetivo de v048 es validar controles y trazabilidad, no promover persistencia. Toda ejecución de ensayo usa rollback-only y rechaza señales peligrosas (`ADEIN_DB_COMMIT=1`, `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`, `ADEIN_DB_ENABLE_WRITES=1`, etc.).

## Gates requeridos para rollback-only
Se requieren todos estos valores:
- `ADEIN_DB_MODE=rollback_only`
- `ADEIN_DB_ROLLBACK_ONLY=1`
- `ADEIN_DB_WRITE_GATE=V048_ROLLBACK_REHEARSAL`
- `ADEIN_DB_APPROVAL_TOKEN=APPROVE_V048_ROLLBACK_REHEARSAL`

Además, deben permanecer deshabilitados:
- `ADEIN_DB_COMMIT` distinto de `1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE` distinto de `1`
- `ADEIN_DB_ENABLE_WRITES` distinto de `1`

## Evidencia esperada
Salida JSON con campos de seguridad y evidencia, incluyendo:
- `phase: "v048"`
- `rollbackExecuted`
- `commitExecuted: false`
- `persistentWriteExecuted: false`
- `insertedRowsAttempted`
- `verificationAfterRollback`
- `tablesChecked`
- `evidence`

## Riesgos bloqueados
- Persistencia accidental por commit habilitado.
- Apertura de modo `write`/`read_write`.
- Uso de gates de commit real (`REAL_COMMIT`).
- Ejecución sin aprobación humana explícita.

## Cómo ejecutar default dry-run
```bash
npm run db:controlled-write:real-rehearsal
```

## Cómo ejecutar self-check
```bash
npm run db:controlled-write:real-rehearsal:self-check
```

## Cómo ejecutar rollback-only en servidor (sin credenciales reales)
```bash
ADEIN_DB_MODE=rollback_only \
ADEIN_DB_ROLLBACK_ONLY=1 \
ADEIN_DB_WRITE_GATE=V048_ROLLBACK_REHEARSAL \
ADEIN_DB_APPROVAL_TOKEN=APPROVE_V048_ROLLBACK_REHEARSAL \
ADEIN_DB_HOST=<db_host> \
ADEIN_DB_PORT=<db_port> \
ADEIN_DB_USER=<db_user> \
ADEIN_DB_PASSWORD=<db_password> \
ADEIN_DB_NAME=<db_name> \
npm run db:controlled-write:real-rehearsal
```

## Checklist antes de evaluar escritura persistente futura
- Aprobación humana explícita documentada.
- Backup verificado.
- Snapshot before/after verificados.
- Evidencia JSON archivada y auditada.
- Validación de bloqueo de señales peligrosas.
- Confirmar que fixtures sintéticos no persisten tras rollback.

## Siguiente fase recomendada
`v049 Controlled Persistent Write Candidate / Minimum Safe Commit Planning`, manteniendo requisito de autorización humana explícita antes de cualquier posibilidad de persistencia.

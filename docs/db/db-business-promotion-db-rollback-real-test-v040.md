# v040 — Business Promotion DB Rollback Real Controlled Test

## Objetivo de v040

v040 agrega una capa mínima de verificación para ejecutar de forma controlada una prueba real **rollback-only** en MariaDB usando el harness v039 como base, sin reescribirlo.

## Qué valida v040

- Reutiliza `db-business-promotion-db-rollback-live-test.mjs` (v039).
- Verifica automáticamente evidencia de ejecución segura:
  - `mode` esperado (`dry_run` o `db_rollback_live_test`).
  - `databaseMode: rollback_only` cuando se ejecuta modo real controlado.
  - `rollbackExecuted: true` en modo real controlado.
  - `commitAllowed: false`.
  - `commitExecuted: false`.
  - `persistedRowsAfterRollback: 0`.
- Mantiene salida JSON para auditoría operativa.

## Qué NO hace v040

- No ejecuta `COMMIT`.
- No crea rutas de persistencia fuera de rollback.
- No incluye ni imprime credenciales hardcodeadas.
- No inserta datos reales.
- No reemplaza autorización manual del operador.

## Variables requeridas

### Gates obligatorios para ejecución real controlada

- `ADEIN_DB_ROLLBACK_LIVE_TEST=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V039`
- `ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1`

### Conexión por entorno (operador)

- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`
- `ADEIN_DB_NAME`

## Comandos v040

### Dry-run seguro por defecto

```bash
npm run db:business-promotion:db-rollback-real-test
```

### Self-check v040

```bash
npm run db:business-promotion:db-rollback-real-test:self-check
```

### Ejecución real controlada (solo operador autorizado)

```bash
ADEIN_DB_ROLLBACK_LIVE_TEST=1 \
ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V039 \
ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1 \
ADEIN_DB_HOST="<host_placeholder>" \
ADEIN_DB_PORT="<port_placeholder>" \
ADEIN_DB_USER="<user_placeholder>" \
ADEIN_DB_PASSWORD="<password_placeholder>" \
ADEIN_DB_NAME="<db_name_placeholder>" \
npm run db:business-promotion:db-rollback-real-test
```

## Evidencia temporal fuera del repo

Guardar evidencia en ruta temporal local del operador, por ejemplo:

```bash
mkdir -p /tmp/adein-v040-evidence
npm run db:business-promotion:db-rollback-real-test | tee /tmp/adein-v040-evidence/db-rollback-real-test.json
```

## Validación de no persistencia

La evidencia es válida solo si se cumple simultáneamente:

- `rollbackExecuted: true`
- `commitAllowed: false`
- `commitExecuted: false`
- `persistedRowsAfterRollback: 0`

Si cualquier condición falla, el resultado debe tratarse como **fallido** y se debe bloquear tag/release.

## Criterios para NO taguear

No taguear si ocurre cualquiera de estos casos:

- `ok` en `false`.
- `mode` diferente de `db_rollback_live_test` en ejecución real.
- `databaseMode` distinto de `rollback_only`.
- `rollbackExecuted` distinto de `true`.
- `commitAllowed` distinto de `false`.
- `commitExecuted` distinto de `false`.
- `persistedRowsAfterRollback` distinto de `0`.
- Salida no JSON o evidencia incompleta.

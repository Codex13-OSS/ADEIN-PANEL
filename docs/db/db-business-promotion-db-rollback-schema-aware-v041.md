# DB Business Promotion Rollback Harness Schema-Aware v041

## Resumen
- **Fecha:** 2026-05-22
- **Fase:** v041
- **Objetivo:** corregir la verificación post-rollback para que sea **schema-aware** por tabla y evitar errores `Unknown column` en MariaDB/MySQL.

## Bug encontrado en v040
En ejecución real rollback-only se observó:

```json
{
  "ok": false,
  "phase": "v040",
  "mode": "error",
  "reason": "Unknown column 'name' in 'WHERE'"
}
```

## Causa técnica
El harness usaba un `WHERE` genérico reutilizable para todas las tablas con columnas potenciales como:
`COALESCE(name, ''), COALESCE(full_name, ''), ...`

En MySQL/MariaDB, referenciar una columna inexistente dentro de `COALESCE` falla en parseo/ejecución SQL para esa tabla.

## Fix aplicado (schema-aware)
Se implementó construcción table-aware de condición de búsqueda:
1. Whitelist explícita de columnas textuales por tabla.
2. Intersección whitelist vs columnas reales detectadas por `INFORMATION_SCHEMA.COLUMNS`.
3. Construcción de `CONCAT_WS(...COALESCE(col,''))` **solo con columnas existentes**.
4. Si no hay columnas válidas para búsqueda, la tabla se marca como `skipped` con razón `no_schema_aware_search_columns` y cuenta `0` sin tronar.

## Tablas y columnas consideradas
- `clients`: `full_name`, `phone`, `email`, `status`, `source`, `notes`
- `properties`: `name`, `location`, `status`
- `lots`: `lot_code`, `status`, `currency`
- `contracts`: `contract_code`, `contract_status`, `source_doc_id`, `currency`
- `payment_schedule`: `payment_status`, `notes`

## Garantías rollback-only conservadas
- `commitAllowed: false`
- `commitExecuted: false`
- rollback obligatorio en modo real
- `persistedRowsAfterRollback: 0` como criterio de éxito
- modo por defecto sigue en `dry_run`
- gates explícitos para habilitar ejecución real

## Validación local (Codex) recomendada
```bash
npm run db:business-promotion:db-rollback-live-test
npm run db:business-promotion:db-rollback-live-test:self-check
npm run db:business-promotion:db-rollback-real-test
npm run db:business-promotion:db-rollback-real-test:self-check
npm run build
```

## Repetición de prueba real rollback-only en servidor (Contabo)
1. Exportar gates y conexión del entorno controlado.
2. Ejecutar únicamente en modo rollback-only:
```bash
ADEIN_DB_ROLLBACK_LIVE_TEST=1 \
ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V041 \
ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1 \
node scripts/db-business-promotion-db-rollback-real-test.mjs
```
3. Confirmar en salida JSON:
   - `ok: true`
   - `mode: verified_controlled_real_execution`
   - `databaseMode: rollback_only`
   - `rollbackExecuted: true`
   - `commitAllowed: false`
   - `commitExecuted: false`
   - `persistedRowsAfterRollback: 0`

## Criterios de éxito
- Dry-run local OK sin DB.
- Self-checks OK.
- Real rollback-only en servidor sin `Unknown column`.
- Persistencia post-rollback en 0.

## Criterios para NO taguear
- Cualquier `mode: error` o `mode: rejected` inesperado.
- `persistedRowsAfterRollback != 0`.
- `commitAllowed !== false` o `commitExecuted !== false`.
- Señales de cambios fuera de scope o credenciales hardcodeadas.

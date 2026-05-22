# DB Business Promotion Rollback Harness v042 (required columns + relationship-aware fixture)

## Qué falló en v041
La ejecución real controlada en Contabo con `ROLLBACK_ONLY_V041` falló al insertar `payment_schedule` por columna obligatoria faltante (`installment_number`), aunque no hubo persistencia final.

## Required columns reales
- `clients`: `full_name`
- `properties`: `name`
- `lots`: `property_id`, `lot_code`
- `contracts`: `client_id`, `lot_id`, `contract_code`
- `payment_schedule`: `contract_id`, `installment_number`, `due_date`, `expected_amount`

## Orden relacional de inserción (v042)
1. `properties`
2. `lots` (usa `property_id`)
3. `clients`
4. `contracts` (usa `client_id`, `lot_id`)
5. `payment_schedule` (usa `contract_id`)

## Fixture demo rollback-only
- Datos ficticios y marcados con token `REHEARSAL_V042_ADEIN_V042_ROLLBACK_TEST_*`.
- Captura `insertId` en cada inserción para poblar relaciones dependientes.
- Si falta una columna requerida o falla una constraint relacional, devuelve error JSON claro y fuerza rollback.

## Gates explícitos v042
Para ejecución real controlada deben existir simultáneamente:
- `ADEIN_DB_ROLLBACK_LIVE_TEST=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V042`
- `ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1`

Sin gates completos, la ejecución debe quedar rechazada.

## Comando dry-run (seguro por defecto)
```bash
npm run db:business-promotion:db-rollback-live-test
```

## Comando real controlado (solo en Contabo)
```bash
ADEIN_DB_ROLLBACK_LIVE_TEST=1 \
ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V042 \
ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1 \
npm run db:business-promotion:db-rollback-real-test
```

## Criterios de éxito
- `rollbackExecuted: true`
- `commitAllowed: false`
- `commitExecuted: false`
- `persistedRowsAfterRollback: 0`

## Criterios de NO taguear
- Falta de gates explícitos.
- Error en inserciones relacionales/required columns.
- `rollbackExecuted !== true`.
- `persistedRowsAfterRollback !== 0`.

## Confirmación de no persistencia
El flujo v042 es exclusivamente rollback-only; no debe dejar filas persistidas.

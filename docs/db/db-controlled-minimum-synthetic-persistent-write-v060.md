# v060 / v060.1 - Controlled Minimum Synthetic Persistent Write (Staging)

## Objetivo
Implementar una escritura persistente mínima y controlada para CRM en staging, con datos **100% sintéticos**, bajo gates estrictos y abortos explícitos.

## Cambios v060.1
- Fixture **schema-aware explícito por tabla** (sin builder frágil) para evitar mismatch de columnas requeridas.
- `existingSyntheticTokenCheck` ahora usa `LIKE ?` parametrizado con `%TOKEN%` para detectar token embebido en textos.
- Rollback explícito si falla después de `beginTransaction()` y antes de `commit()`.
- Si hay falla post-commit, el payload preserva `commitExecuted:true` y `persistentWriteExecuted:true` (no los pisa en `fail()`).
- No hay limpieza automática; no se usan `DELETE/UPDATE/DROP/TRUNCATE/ALTER`.

## Qué escribe exactamente (modo real controlado)
- 1 row: `properties`
- 1 row: `lots` (relacionada con `property`)
- 1 row: `clients`
- 1 row: `contracts` (relacionada con `client` + `lot`)
- 1 row: `payment_schedule` (relacionada con `contract`)

Total esperado: **5 rows**.

## Fixture sintético v060.1
Token fijo: `ADEIN_SYNTHETIC_V060_2026_05_25`
- `properties.name`: `PROPIEDAD SINTETICA V060 - NO REAL - ADEIN_SYNTHETIC_V060_2026_05_25`
- `lots.lot_code`: `LOTE-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC`
- `clients.full_name`: `CLIENTE SINTETICO V060 - NO REAL - ADEIN_SYNTHETIC_V060_2026_05_25`
- `clients.email`: `cliente.sintetico.v060@example.invalid`
- `contracts.contract_code`: `CONTRATO-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC`
- `payment_schedule.notes`: `TOKEN ADEIN_SYNTHETIC_V060_2026_05_25 - NO REAL`
- `raw_payload_json` en todas: `{"synthetic":true,"phase":"v060","token":"ADEIN_SYNTHETIC_V060_2026_05_25"}`

## Validación de schema
Se valida por tabla:
- `requiredColumnsByTable`
- `providedColumnsByTable`
- `missingRequiredColumnsByTable`
- `schemaValidationByTable`

Regla: solo exige columnas `NOT NULL` sin default y sin `auto_increment`.

## Rollback/errores
- Falla antes de transacción: `rollbackExecuted:false`.
- Falla en transacción pre-commit: rollback explícito y `rollbackExecuted:true`.
- Falla post-commit: `postCommitFailure:true`, no rollback, requiere revisión manual.

## Comandos
```bash
npm run db:controlled-minimum-synthetic-write:v060
npm run db:controlled-minimum-synthetic-write:v060:self-check
```

## Seguridad
- Default safe (sin gate): `databaseConnected:false`, `transactionOpened:false`, `insertsExecuted:0`, `commitExecuted:false`, `persistentWriteExecuted:false`.
- Prohibido ejecutar en producción.
- Sin uso de datos reales.

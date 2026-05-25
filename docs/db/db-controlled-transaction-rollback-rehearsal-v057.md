# v057 — Controlled Transaction Rollback Rehearsal

## Propósito
La fase **v057** prepara un ensayo transaccional controlado en MariaDB usando datos 100% sintéticos y controlados. Este ensayo es **rollback-only**: se permite abrir transacción e insertar filas sintéticas, pero siempre se revierte y nunca se persiste nada.

## Principios de seguridad
- No hay commit permitido.
- No hay persistencia de datos.
- No se usan datos reales.
- No hay cambios de esquema ni migraciones.
- Solo se permite el flujo explicitado con gate de rollback.

## Base obligatoria
- Tag base: `v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix`
- HEAD esperado: `a3dce91`

## Backup requerido
- Path: `/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql`
- SHA256 esperado: `3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d`

## Tablas permitidas
- `properties`
- `lots`
- `clients`
- `contracts`
- `payment_schedule`

## Tablas prohibidas
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`
- Cualquier tabla fuera del whitelist permitido.

## Row counts esperados
Antes del rehearsal y después del rollback, deben estar en **0**:
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Modos de ejecución

### 1) Modo default (dry-run, sin BD)
```bash
npm run db:controlled-transaction:rollback-rehearsal
```
Devuelve JSON con `dryRun:true`, `rollbackOnly:true`, y sin abrir conexión.

### 2) Modo rollback-only controlado
```bash
ADEIN_V057_ROLLBACK_REHEARSAL=1 \
ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env \
ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V057 \
npm run db:controlled-transaction:rollback-rehearsal
```
Flujo:
1. Carga env externo (`ADEIN_DB_ENV_FILE`) sin imprimir secretos.
2. Valida `ADEIN_DB_*` requeridos.
3. Verifica existencia y SHA256 del backup v054.
4. Verifica row counts iniciales en 0.
5. Abre transacción explícita.
6. Inserta filas sintéticas en orden relacional (`properties -> lots -> clients -> contracts -> payment_schedule`).
7. Verifica filas dentro de transacción con token v057.
8. Ejecuta rollback.
9. Verifica row counts post-rollback nuevamente en 0.

## Gates requeridos
- `ADEIN_V057_ROLLBACK_REHEARSAL=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V057`
- `ADEIN_DB_ENV_FILE` apuntando a env válido con `ADEIN_DB_*`.

## Criterios de aborto
Aborta con exit code 1 si ocurre cualquier condición:
- envs peligrosos de commit/write habilitados,
- gate incorrecto o ausente,
- faltan variables `ADEIN_DB_*`,
- backup faltante o SHA256 distinto,
- row counts iniciales distintos de 0,
- error de metadata/columnas requeridas,
- cualquier señal de intento de persistencia real.

## Validación local recomendada
```bash
npm run db:controlled-transaction:rollback-rehearsal
npm run db:controlled-transaction:rollback-rehearsal:self-check
```

## Siguiente fase sugerida
**v058**: `minimum persistent write approval artifact / human authorization gate`, aún sin habilitar commit hasta decisión y autorización humana explícita.

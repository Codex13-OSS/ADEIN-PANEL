# ADEIN CRM — Controlled Write Dry-Run v045

## Objetivo
Implementar una fase técnica de rehearsal para preparar una futura escritura controlada, manteniendo bloqueo total de escritura persistente real y de COMMIT real.

## Qué implementa
- Script principal `scripts/db-controlled-write-dry-run.mjs` en modo `dry_run` por defecto.
- Fixture demo sintético (sin datos reales).
- Construcción en memoria de un plan de write controlado para tablas candidatas.
- Validaciones de scope, orden relacional, columnas mínimas y relaciones.
- Rechazo explícito de intento de COMMIT real vía `ADEIN_DB_COMMIT=1` (o señales equivalentes).
- Salida JSON estructurada por `stdout` sin escritura automática de archivos.
- Self-check dedicado en `scripts/db-controlled-write-dry-run-self-check.mjs`.

## Qué NO implementa
- No escritura persistente real en base de datos.
- No ejecución de `connection.commit()` ni `.commit()`.
- No conexión UI/frontend a rutas de escritura.
- No cambio de schema SQL.
- No uso de datos reales.
- No credenciales nuevas ni hardcodeadas.
- No OpenAI/IA.

## Relación con v042, v043 y v044
- **v042** validó rollback-only real controlado (persistencia final cero).
- **v043** cerró evidencia y checklist de readiness.
- **v044** formalizó plan y protocolo de aprobación.
- **v045** implementa rehearsal técnico commit-disabled en seco para preparar v046 sin habilitar persistencia real.

## Scripts npm agregados
- `db:controlled-write:dry-run`
- `db:controlled-write:dry-run:self-check`

## Modo por defecto
- `dry_run` obligatorio por defecto.
- `dryRun: true` en salida.

## Commit bloqueado
- `commitAllowed: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`
- Si se detecta `ADEIN_DB_COMMIT=1`, la ejecución se rechaza con exit code `1`.

## Fixture demo sintético
Se usa dataset controlado y sintético únicamente:
- Cliente demo
- Propiedad demo
- Lote demo
- Contrato demo
- Cronograma de pago demo

Todos los identificadores y emails usan formato no real (`example.invalid`).

## Tablas candidatas (en scope)
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas bloqueadas (fuera de scope)
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Output esperado (resumen)
El script principal imprime JSON con campos mínimos:
- `ok`
- `phase: "v045"`
- `mode`
- `dryRun: true`
- `commitAllowed: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`
- `writesPlanned`
- `tablesInScope`
- `tablesBlocked`
- `relationshipOrder`
- `requiredColumnsCheck`
- `approvalRequiredBeforeRealWrite: true`
- `warnings`
- `nextRecommendedPhase`

## Self-check
El self-check:
1. Ejecuta dry-run normal y valida JSON/flags/scope/relaciones.
2. Ejecuta caso negativo con `ADEIN_DB_COMMIT=1`.
3. Verifica rechazo explícito del intento de commit real.
4. Finaliza con `exit 0` solo si todas las assertions pasan.

## Criterios de aceptación
- Scripts nuevos ejecutan correctamente.
- Self-check pasa.
- Build del proyecto pasa.
- Sin `connection.commit()`.
- Sin COMMIT real.
- Sin escritura persistente real.
- Sin datos reales.
- Sin credenciales.
- Sin OpenAI/IA.

## Riesgos mitigados
- Persistencia accidental: mitigada con commit hard-block en v045.
- Scope drift: mitigado por validación explícita de tablas permitidas/bloqueadas.
- Integridad relacional: mitigada por validación de orden y relaciones.
- Falsa preparación operativa: mitigada con self-check y salida verificable.

## Qué sigue (v046)
Siguiente fase sugerida:
- `controlled write approval artifact / preflight with backup verification`, o
- `server-side commit-disabled rehearsal`,
siempre sin escritura persistente real hasta autorización explícita futura.

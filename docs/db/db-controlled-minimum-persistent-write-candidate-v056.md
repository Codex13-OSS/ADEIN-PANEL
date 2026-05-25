# v056 — Controlled Minimum Persistent Write Candidate

## Propósito
Preparar el **candidate/rehearsal** de la primera escritura mínima persistente controlada, sin ejecutar escrituras reales ni COMMIT en esta fase.

## Alcance de v056
- Script principal: `npm run db:controlled-minimum-write:candidate`
- Self-check: `npm run db:controlled-minimum-write:candidate:self-check`
- Solo planeación/control de candidate artifact en JSON.

## Garantías de seguridad en v056
- No hay escritura persistente real.
- No hay COMMIT.
- Solo datos sintéticos/controlados como plan futuro.
- `dryRun: true` por defecto.
- `candidateOnly: true` por defecto.

## Tablas permitidas (candidate plan)
- `properties`
- `lots`
- `clients`
- `contracts`
- `payment_schedule`

## Tablas prohibidas en v056
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`
- cualquier tabla no listada como permitida

## Artifact esperado
Incluye:
- `baseCheckpoint.tag`: `v0.1.46-adein-crm-prewrite-approval-gate`
- `baseCheckpoint.expectedHead`: `5e09e5b`
- `requiredBackup.path`: `/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql`
- `requiredBackup.expectedSha256`: `3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d`
- row counts requeridos en 0 para: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`
- plan relacional sintético mínimo y secuencia de ejecución con rollback por defecto

## Approval gate futuro (bloqueado en v056)
- `humanApprovalRequired: true`
- token futuro: `APPROVE_V056_MINIMUM_SYNTHETIC_PERSISTENT_WRITE`
- en v056, si el token se pasa, **se rechaza**
- `commitStillBlocked: true`

## Criterios de aborto
- backup faltante
- SHA256 del backup no coincide
- row counts no están todos en cero
- falta env file cuando se pide modo controlado
- intento de tocar puerto de producción
- detección de datos reales
- detección de variables de commit fuera de fase permitida
- schema mismatch
- solicitud de tablas fuera de lista permitida

## Modo opcional controlled read-only
Variables:
- `ADEIN_V056_CONTROLLED_READONLY=1`
- `ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env`

En este modo:
- puede validar existencia de env file y backup + sha
- sigue sin INSERT/UPDATE/DELETE
- sin transacción de escritura
- sin COMMIT

## Comandos de validación
```bash
npm run db:controlled-minimum-write:candidate
npm run db:controlled-minimum-write:candidate:self-check
npm run build
```

## Siguiente fase sugerida
Rehearsal transaccional **rollback-only** controlado en servidor antes de cualquier COMMIT persistente futuro.

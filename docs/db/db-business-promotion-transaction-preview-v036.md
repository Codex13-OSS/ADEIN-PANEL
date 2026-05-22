# v036 - Business Promotion Transaction Preview / Conflict Check

## Qué es v036

v036 agrega una capa de **preview/diff transaccional** previa a cualquier escritura futura de promoción hacia tablas de negocio.

Se ejecuta en memoria y evalúa el orden:

`clients → properties → lots → contracts → payment_schedule`

## Qué NO hace v036

- No escribe en BD.
- No migra datos reales.
- No usa credenciales ni `.env`.
- No activa write gate.
- No usa IA/OpenAI.
- No usa datos reales.
- No toca UI/frontend.
- No toca backend/API read-only.
- No toca auth/login/mobile/documentos.

## Diferencia v035 vs v036

- **v035**: dry-run + write gate para promoción de negocio.
- **v036**: preview transaccional con validaciones de orden, relaciones, duplicados y conflictos antes de cualquier escritura.

## Orden transaccional obligatorio

1. `clients`
2. `properties`
3. `lots`
4. `contracts`
5. `payment_schedule`

## Tablas permitidas (preview)

- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas fuera de scope

- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Comandos

```bash
npm run db:business-promotion:preview
npm run db:business-promotion:preview:self-check
```

## Cómo interpretar

- `readySteps`: pasos listos.
- `skippedSteps`: pasos omitidos.
- `blockedSteps`: pasos bloqueados.
- `blockers`: motivos críticos de bloqueo.
- `warnings`: advertencias no críticas.
- `conflicts`: conflictos detectados.

## Criterio de aceptación v036

1. `npm run db:business-promotion:preview` retorna JSON parseable con `ok: true`.
2. `mode` es `dry_run` y `writesEnabled` es `false`.
3. `npm run db:business-promotion:preview:self-check` pasa validaciones de scope, orden y tablas.
4. No hay conexión real a BD ni escritura real en esta fase.

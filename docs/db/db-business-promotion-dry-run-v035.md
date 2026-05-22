# v035 - Business Promotion Dry-Run / Write Gate

## Qué hace v035
La fase **v035** prepara la promoción futura y controlada de datos hacia tablas de negocio del CRM:

- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

En esta entrega, el comportamiento operativo es seguro y **dry-run por defecto**.

## Seguridad por defecto
- Corre en `mode: "dry_run"`.
- `writesEnabled` se reporta en `false` por defecto.
- No ejecuta escritura real en BD por defecto.
- No requiere credenciales reales para self-check.
- No ejecuta migraciones reales.
- Usa payload demo seguro/falso.

## Tablas objetivo permitidas
Solo se prepara promoción para:
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`

## Tablas prohibidas en esta fase
No se toca ni escribe en:
- `crm_users`
- `sellers`
- `crm_followups`
- `import_batches`
- `import_raw_rows`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Write gate requerido (referencia para fase futura)
La compuerta de escritura queda preparada y exige **las 3 variables exactas**:

```bash
ADEIN_DB_WRITES_ENABLED=true
ADEIN_DB_WRITE_SCOPE=business_promotion
ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE=YES_I_UNDERSTAND_BUSINESS_TABLES_ONLY
```

> Importante: aunque el gate esté preparado, en v035 no se opera escritura real como parte del flujo validado.

## Comandos de validación
```bash
npm run db:business-promotion
npm run db:business-promotion:self-check
npm run build
```

## Confirmaciones de alcance
- Esta fase **NO** carga datos reales.
- Esta fase **NO** usa IA/OpenAI.
- Esta fase **NO** toca UI/auth/login/mobile/documentos.
- La promoción real queda para una fase posterior con autorización explícita.

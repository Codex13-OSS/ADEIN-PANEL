# DB Migration Plan Write Gate v034

## Objetivo
La fase **v034** habilita persistencia controlada únicamente para planes de migración en MariaDB.

Resuelve guardar de forma gobernada:
- `migration_plans`
- `migration_plan_events`

Por diseño, esta fase **no promueve datos a tablas de negocio** y mantiene patrón de seguridad dry-run/write-gate.

## Seguridad por defecto
El comando corre en modo `dry_run` por defecto:
- No escribe en BD.
- No requiere credenciales para dry-run.
- Reporta `wouldInsert` con conteos para validación.

## Tablas permitidas en escritura v034
Solo se permite `INSERT INTO` hacia:
- `migration_plans`
- `migration_plan_events`

## Tablas explícitamente no tocadas en v034
- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`
- `import_batches`
- `import_raw_rows`
- `audit_log`

## Comandos
### Dry-run (default)
```bash
npm run db:migration-plan
```

### Self-check
```bash
npm run db:migration-plan:self-check
```

## Write gate (referencia, NO ejecutar en esta entrega sin autorización explícita)
```bash
ADEIN_DB_WRITES_ENABLED=true \
ADEIN_DB_WRITE_SCOPE=migration_plan \
ADEIN_CONFIRM_MIGRATION_PLAN_WRITE=YES_I_UNDERSTAND_MIGRATION_PLAN_ONLY \
npm run db:migration-plan
```

> Esta escritura real **no debe ejecutarse** en esta entrega salvo autorización explícita del usuario.

## Roadmap
- **v035**: promoción controlada a `clients/properties/lots/contracts/payment_schedule`
- **v036**: dashboard real read-only con datos migrados
- **v037+**: IA read-only analista

# v033 - Import staging write gate (controlado)

## Qué resuelve v033

v033 prepara una **persistencia controlada de staging de importación** con guardas explícitas.
Por defecto, el flujo opera en `dry_run` y **no escribe** en base de datos.

Esta fase solo habilita el camino técnico para insertar fixtures demo en tablas de staging cuando exista autorización explícita vía variables de entorno.

## Alcance de escritura permitido

Únicamente se permite escritura en:

- `import_batches`
- `import_raw_rows`

## Fuera de alcance (no se toca en v033)

- `clients`
- `properties`
- `lots`
- `contracts`
- `payment_schedule`
- `migration_plans`
- `migration_plan_events`
- `audit_log`

## Comandos

### Dry-run (default)

```bash
npm run db:import-staging
```

- Modo esperado: `dry_run`
- `writesEnabled=false`
- `executed=false`
- No requiere ejecutar escrituras reales.

### Self-check

```bash
npm run db:import-staging:self-check
```

Valida fixture, modo default, guardas de seguridad y restricción de tablas permitidas.

## Ejemplo de write gate real (NO ejecutar en esta entrega sin autorización)

```bash
ADEIN_DB_WRITES_ENABLED=true \
ADEIN_DB_WRITE_SCOPE=import_staging \
ADEIN_CONFIRM_IMPORT_STAGING_WRITE=YES_I_UNDERSTAND_IMPORT_STAGING_ONLY \
npm run db:import-staging
```

> Importante: este comando representa escritura real controlada y **no debe ejecutarse en esta entrega** salvo autorización explícita del usuario.

## Roadmap

- `v034`: persistir `migration_plans` / `migration_plan_events`
- `v035`: promoción controlada hacia tablas de negocio
- `v036`: dashboard real read-only
- `v037+`: IA read-only analista

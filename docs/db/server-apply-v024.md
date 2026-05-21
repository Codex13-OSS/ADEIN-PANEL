# ADEIN CRM DB schema applied — v024

**Fecha operativa:** 2026-05-21

## Alcance

Aplicación operativa, manual y controlada del schema SQL v023 en servidor para la base `adein_crm`, en modo sanitizado y sin integración de aplicación:

- Aplicación manual/controlada del schema v023.
- Sin conexión de app/backend/frontend a MariaDB en esta fase.
- Sin ejecución de seed demo.
- Sin carga de datos reales.

## Pre-check

Antes de aplicar el schema:

- La base `adein_crm` ya existía vacía.
- `tablas_antes = 0`.

## Backup pre-schema (fuera del repo)

Se generó un backup pre-schema de forma externa al repositorio (solo referencia operativa sanitizada):

- Ruta: `/root/adein-db-v023/backups/adein_crm_pre_schema_20260521_020459.sql`

> No se incluyen credenciales, passwords ni contenido del dump en este repositorio.

## Aplicación

Se aplicó manualmente en servidor el archivo:

- `docs/db/001_initial_schema.sql`

## Resultado

Después de aplicar el schema:

- `tablas_despues = 13`

Tablas creadas:

1. `audit_log`
2. `clients`
3. `contracts`
4. `crm_followups`
5. `crm_users`
6. `import_batches`
7. `import_raw_rows`
8. `lots`
9. `migration_plan_events`
10. `migration_plans`
11. `payment_schedule`
12. `properties`
13. `sellers`

## Self-check

Resultado operativo de `docs/db/self-check.sql`:

- `tables_missing = NULL`
- `critical_columns_missing = 0`
- `required_indexes_missing = 0`

## Validación de datos

Validación final confirmada:

- Todas las 13 tablas quedaron con `0` filas.

## Confirmaciones

- **NO** se ejecutó `docs/db/002_seed_demo_optional.sql`.
- **NO** se cargaron datos reales.
- **NO** se conectó frontend/backend a la BD.
- **NO** se agregaron credenciales al repo.

## Siguiente fase recomendada

1. Preparar conexión backend/API a MariaDB en una rama futura.
2. Mantener confirmación humana explícita antes de cualquier migración o carga real.

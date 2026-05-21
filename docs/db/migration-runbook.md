# Migration Runbook (Manual) - v023

> Este runbook es manual. v023 **no ejecuta** nada automáticamente desde la app.

## 1) Preparación
1. Confirmar acceso al servidor y respaldo de credenciales fuera de repo.
2. Confirmar que la base objetivo es `adein_crm` y que está vacía para primera aplicación.

## 2) Aplicar schema inicial manualmente
Ejemplo de ejecución manual con cliente MariaDB:

```bash
mariadb -u adein_app -p adein_crm < docs/db/001_initial_schema.sql
```

## 3) Verificación post-aplicación
Ejecutar self-check:

```bash
mariadb -u adein_app -p adein_crm < docs/db/self-check.sql
```

Revisar que:
- `tables_missing` no liste tablas.
- `critical_columns_missing` sea 0.
- `required_indexes_missing` sea 0.
- `business_tables_non_empty_without_seed` no retorne filas (si no se aplicó seed).

## 4) Seed demo opcional
**No ejecutar en producción.**
Solo para sandbox/demo local:

```bash
mariadb -u adein_app -p adein_crm < docs/db/002_seed_demo_optional.sql
```

## 5) Verificación rápida de tablas
```sql
SHOW TABLES;
SELECT COUNT(*) FROM migration_plans;
SELECT COUNT(*) FROM import_batches;
SELECT COUNT(*) FROM import_raw_rows;
SELECT COUNT(*) FROM payment_schedule;
SELECT COUNT(*) FROM audit_log;
```

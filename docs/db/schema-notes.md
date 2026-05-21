# Schema Notes v023

- Motor: InnoDB.
- Charset/collation: `utf8mb4` / `utf8mb4_unicode_ci`.
- Claves primarias: `BIGINT UNSIGNED AUTO_INCREMENT`.
- Campos JSON: `LONGTEXT` + `CHECK (JSON_VALID(...))` para compatibilidad conservadora en MariaDB 10.6.
- Catálogos separados:
  - `crm_users`: identidad de operador/sistema.
  - `sellers`: entidad comercial separada de login.
- Integración de import/migration plan:
  - `import_batches`, `import_raw_rows`, `migration_plans`, `migration_plan_events`.
- Auditoría:
  - `audit_log` para snapshots before/after y metadata.

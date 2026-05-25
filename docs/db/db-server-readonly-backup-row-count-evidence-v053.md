# v053 — Server Read-Only Backup + Row Count Evidence

## Objetivo de v053
La fase **v053** define una ejecución estrictamente **read-only/evidence-only** para preparar evidencia real en servidor antes de cualquier fase con escritura persistente en base de datos.

## Qué valida
- Modo seguro por defecto (dry-run sin conexión DB).
- Gates explícitos para permitir intento de conexión en servidor.
- Lectura de credenciales solo desde archivo externo (`/root/adein-secrets/adein-crm-db.env`).
- Conteos por tabla exclusivamente en listas permitidas (`SELECT COUNT(*)`).
- Bloqueo de cualquier posibilidad de escritura o commit SQL.
- Evidencia de salud para producción (`3006`) y staging (`3016`) sin tocar PM2 ni puertos.
- Evidencia de backup/snapshot requerido antes de una fase de escritura.

## Por qué es read-only/evidence-only
v053 está diseñada para **cero escrituras**:
- `writesEnabled=false`
- `commitAllowed=false`
- `commitExecuted=false`
- `persistentWriteExecuted=false`

Incluso con gates de servidor activos, solo se permite observación (conteos) y evidencia.

## Cómo correr en Mac (default seguro)
```bash
npm run db:server-readonly:evidence
npm run db:server-readonly:evidence:self-check
```

Resultado esperado:
- JSON válido.
- `ok=true`.
- Sin intento de conexión DB.
- Sin lectura de archivo de credenciales.

## Cómo correr en servidor con gates seguros
```bash
export ADEIN_V053_SERVER_READONLY_EVIDENCE=1
export ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env
npm run db:server-readonly:evidence
```

Condiciones:
- Si falta el archivo o variables requeridas, el script aborta de forma segura con JSON válido.
- Nunca imprime password.
- Nunca persiste credenciales en artefacto.

## Tablas observadas (permitidas)
- `clients`
- `properties`
- `lots`
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
- Cualquier tabla no listada en `allowedTables`

## Evidencia que produce
El JSON incluye:
- metadatos de fase/base;
- safety envelope de no-escritura;
- plan/evidencia de backup/snapshot requerido;
- row count evidence por tablas permitidas (solo con gates explícitos);
- evidencia de salud de producción/staging;
- condiciones de aborto y siguiente paso recomendado.

## Qué NO hace
- No ejecuta `INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE/CREATE`.
- No ejecuta `COMMIT` ni `ROLLBACK`.
- No migra datos.
- No modifica schema.
- No toca frontend/UI/auth/login/mobile/documentos/src/schema.
- No usa credenciales en repo.

## Relación con v052 staging
v053 se apoya en el preflight de servidor de v052 y agrega evidencia read-only real para preparar una siguiente fase controlada, manteniendo producción/staging vivos y sin escritura.

## Siguiente paso recomendado (v054)
Definir v054 como fase de aprobación operativa con backup/snapshot verificados, evidencia humana firmada y gates explícitos adicionales antes de habilitar cualquier capacidad de escritura controlada.

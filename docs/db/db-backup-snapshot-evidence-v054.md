# v054 — Controlled Backup Snapshot Evidence (Pre-Write Server Evidence Pack)

## Objetivo
Esta fase implementa evidencia previa a cualquier fase futura con escritura real en BD. El objetivo es generar pruebas auditables de backup/snapshot sin ejecutar escrituras de negocio, sin COMMIT SQL y sin migraciones.

## Por qué es una fase pre-write evidence
- Obliga gates explícitos para modo real.
- En ejecución por defecto usa `dry-run` seguro.
- El resultado esperado en default es JSON con `ok: true`, `dryRun: true`, `databaseConnected: false`, `backupCreated: false`.

## Ejecución en dry-run (default)
```bash
npm run db:backup-snapshot:evidence
```
Comportamiento:
- No conecta a BD.
- No crea backup.
- No toca puertos productivos ni PM2.
- Devuelve JSON de seguridad con flags de no-escritura.

## Ejecución en servidor (modo real controlado)
Requiere gates exactos:
```bash
export ADEIN_V054_BACKUP_SNAPSHOT_EVIDENCE=1
export ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env
export ADEIN_BACKUP_DIR=/root/adein-backups
npm run db:backup-snapshot:evidence
```

## Dónde se guarda la evidencia
Fuera del repo:
- Base: `/root/adein-backups`
- Carpeta objetivo: `/root/adein-backups/adein_crm/v054/<timestamp>/`
- Artifact JSON: `backup_evidence_v054.json` dentro de esa carpeta.

## Qué SÍ hace en modo real controlado
- Lee el env externo con esquema `ADEIN_DB_*` (sin imprimir valores).
- Verifica que el backup dir esté fuera del repo.
- Captura `SELECT COUNT(*)` de tablas permitidas antes del backup:
  - `clients`
  - `properties`
  - `lots`
  - `contracts`
  - `payment_schedule`
- Verifica health local de:
  - `http://127.0.0.1:3006`
  - `http://127.0.0.1:3016`
- Ejecuta snapshot con `mysqldump` o `mariadb-dump` (si existe).
- Calcula metadata (`sizeBytes`, `sha256`, timestamps y rutas).

## Qué NO hace
- No ejecuta `INSERT/UPDATE/DELETE`.
- No ejecuta `ALTER/DROP/TRUNCATE/CREATE`.
- No hace `COMMIT` SQL.
- No migra datos.
- No cambia schema.
- No guarda datos reales en el repo.

## Tablas observadas y prohibidas
Permitidas:
- `clients`, `properties`, `lots`, `contracts`, `payment_schedule`

Prohibidas:
- `crm_users`, `sellers`, `crm_followups`, `import_batches`, `import_raw_rows`, `migration_plans`, `migration_plan_events`, `audit_log`, y cualquier tabla fuera de `allowedTables`.

## Protección contra secretos
- Nunca imprime password/credenciales.
- No imprime comando con password.
- Si se crea archivo temporal de credenciales, se crea fuera del repo con `chmod 600` y se elimina al finalizar.

## Rollback/Restore plan conceptual
1. Detener cualquier fase write-capable.
2. Verificar integridad del snapshot (`sha256`, tamaño, ruta).
3. Restaurar primero en entorno aislado/no productivo.
4. Revalidar row counts en tablas permitidas.
5. Solicitar aprobación humana explícita antes de cualquier cutover.

## Self-check
```bash
npm run db:backup-snapshot:evidence:self-check
```
Valida dry-run, flags de seguridad, bloqueo de envs peligrosas y consistencia de tablas permitidas/prohibidas.

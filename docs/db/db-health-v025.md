# v025 - DB Health Check (Read-Only)

## Objetivo
Esta fase implementa una primera capa de verificación de conectividad hacia MariaDB para `adein_crm`, sin riesgo de escritura. El chequeo está diseñado para validar estado, no para migrar ni modificar datos.

## Qué incluye
- Script `scripts/db-health-check.mjs` para health-check read-only.
- Comando npm: `npm run db:health`.
- Variables de entorno documentadas en `.env.example`.

## Variables necesarias
Configura estas variables en tu entorno local (o en un `.env` **no versionado**):

- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_NAME`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`

> ⚠️ Nunca subas credenciales reales al repositorio. No commitear `.env` real.

## Ejecución
```bash
npm run db:health
```

## Validaciones que realiza (solo SELECT)
1. Conexión a MariaDB.
2. `SELECT DATABASE()` para validar DB activa.
3. Conteo de tablas en `information_schema.tables` para la base indicada.
4. Verificación de existencia de 13 tablas esperadas:
   - audit_log
   - clients
   - contracts
   - crm_followups
   - crm_users
   - import_batches
   - import_raw_rows
   - lots
   - migration_plan_events
   - migration_plans
   - payment_schedule
   - properties
   - sellers
5. Conteo de filas por tabla (`SELECT COUNT(*)`).
6. Estado final con `ok`, `warning` o `error`.
7. Confirmación explícita de modo `read_only` y `writesEnabled: false`.

## Política de seguridad
- Runtime v025 ejecuta exclusivamente consultas `SELECT`.
- No ejecuta `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, ni `CREATE`.
- No imprime password ni expone el contenido completo de variables de entorno.

## Nota de arquitectura
El proyecto actual es frontend (Vite + React). Este health-check corre del lado Node/CLI. El frontend **no debe** conectarse directamente a MariaDB desde el navegador.

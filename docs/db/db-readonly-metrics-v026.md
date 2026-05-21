# v026 · DB Read-Only Metrics (Node CLI)

## Objetivo
v026 agrega una capa de **métricas read-only** sobre `adein_crm` para consultar agregados básicos desde Node.js sin escribir en BD.

## Alcance
- Script CLI: `scripts/db-readonly-metrics.mjs`
- Comando npm: `npm run db:metrics`
- Salida JSON legible
- Solo operaciones `SELECT`

## Variables de entorno requeridas
- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_NAME`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`

> No hardcodear credenciales ni subir `.env` real al repositorio.

## Ejecución
```bash
npm run db:metrics
```

## Qué reporta
- Conteos base (`clients`, `sellers`, `properties`, `lots`, `contracts`, `payment_schedule`, `crm_followups`, `import_batches`, `migration_plans`)
- Agrupaciones por estatus para entidades clave
- Resumen de cobranza (`expectedTotal`, `paidTotal`, `pendingTotal`, vencidos, próximos 30 días)
- Resumen de pipeline (prospectos activos, followups activos, planes aprobados, lotes aprobados para migración)

## Garantías de seguridad v026
- Runtime en modo `read_only`
- `writesEnabled: false`
- Sin `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE` en runtime de scripts
- No migra datos y no crea datos demo

## Notas operativas
- Mientras la BD real siga en 0 filas (estado esperado de fases previas), las métricas regresarán `0` o `{}`.
- v026 **no** conecta dashboards en vivo todavía.
- El frontend no debe conectarse directo a MariaDB; toda consulta debe pasar por capas controladas de backend/servicios en fases futuras.

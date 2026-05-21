# v027 — Dashboard Snapshot Read-Only

## Objetivo
Generar un snapshot JSON estable para consumo futuro de UI/dashboard usando MariaDB en modo read-only, sin conectar dashboards vivos ni ejecutar escrituras.

## Script
- `scripts/db-dashboard-snapshot.mjs`

## Comando
```bash
npm run db:snapshot
```

## Variables requeridas
- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_NAME`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`

## Garantías de seguridad (runtime)
- Solo ejecuta consultas `SELECT`.
- No ejecuta `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER` ni `CREATE`.
- No imprime credenciales.
- Retorna `writesEnabled: false`.

## Estructura de salida
Incluye los bloques:
- `ok`, `status`, `database`, `mode`, `writesEnabled`, `generatedAt`
- `source` con `metricsVersion: "v026"` y `snapshotVersion: "v027"`
- `summaryCards`
- `dashboard` (`business`, `collection`, `pipeline`)
- `warnings`
- `notes`

## Comportamiento con base vacía
Si no existen registros en entidades clave (`clients`, `lots`, `contracts`):
- Las tarjetas y métricas quedan en `0`.
- Los mapas por estatus quedan como `{}`.
- Se agrega warning indicando base sin registros.

## Integración esperada
La salida JSON se emite en `stdout` para facilitar su uso por una futura UI, manteniendo el desacople de conexiones vivas en esta fase.

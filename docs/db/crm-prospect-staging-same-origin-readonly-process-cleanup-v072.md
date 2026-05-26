# CRM Prospect Staging Same-Origin Readonly Process Cleanup v072

## Objetivo
Agregar validación de process-safety para pruebas temporales v069+v071 sin tocar PM2, producción ni frontend.

## Alcance
- Se agregan handlers de `SIGTERM`/`SIGINT` en v069 y v071 para asegurar `server.close()`.
- Se agrega rehearsal local v072 con puertos de prueba (`3191` y `3126` por defecto).
- Se agrega self-check v072 que valida restricciones de seguridad y ejecuta el rehearsal.

## Garantías de seguridad
- No usa PM2.
- No toca `3006` ni `3016`.
- No ejecuta escrituras ni transacciones.
- No mata procesos por puerto indiscriminadamente; solo termina procesos hijos creados por el propio rehearsal.

## Comandos
- `npm run crm:prospect-staging:same-origin-process-cleanup:rehearsal`
- `npm run crm:prospect-staging:same-origin-process-cleanup:self-check`

## Salida esperada (JSON)
Incluye:
- `ok`
- `phase: "v072"`
- `mode`
- `processesStarted`
- `processesStopped`
- `portsChecked`
- `lingeringProcesses`
- `productionTouched: false`
- `stagingPm2Touched: false`
- `writeExecuted: false`
- `commitExecuted: false`
- `transactionStarted: false`

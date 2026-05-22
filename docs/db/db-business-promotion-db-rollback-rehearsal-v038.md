# v038 — Business Promotion DB Rollback Rehearsal / Real Connection Safety Test

## Qué es v038

La fase **v038** agrega una capa de ensayo seguro para **Business Promotion** que funciona en dos modos:

1. **Dry-run por defecto (sin BD)**.
2. **Rollback rehearsal con conexión real** solo cuando se habilita explícitamente por variables de entorno.

Objetivo: validar que existe una ruta segura para conectar, abrir transacción, insertar datos demo y ejecutar rollback obligatorio sin persistencia.

## Qué NO hace v038

- No migra datos reales.
- No usa credenciales embebidas en código ni repositorio.
- No modifica `.env` real.
- No ejecuta `COMMIT`.
- No aplica cambios de schema (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`).
- No altera flujos de UI, auth, login, mobile, documentos, dashboards o integración IA/OpenAI.

## Seguridad transaccional

- `commitAllowed` siempre es `false`.
- Si se habilita modo BD, la ejecución requiere `ROLLBACK` obligatorio.
- Se usan valores demo/rehearsal internos (nunca datos reales).

## Variables necesarias para modo DB rollback-only

Se requieren **todas**:

- `ADEIN_DB_ROLLBACK_REHEARSAL=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V038`
- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`
- `ADEIN_DB_NAME`

Si falta cualquier gate o variable, el script rechaza el modo BD en forma controlada sin conectar/escribir.

## Comandos

```bash
npm run db:business-promotion:db-rollback-rehearsal
npm run db:business-promotion:db-rollback-rehearsal:self-check
```

## Cómo validar más adelante contra BD real (sin credenciales reales)

1. Preparar un entorno aislado de pruebas con schema compatible.
2. Exportar variables de gate + conexión en la sesión local (sin versionarlas).
3. Ejecutar el comando de rehearsal.
4. Verificar salida JSON:
   - `mode: "db_rollback_rehearsal"`
   - `databaseMode: "rollback_only"`
   - `rollbackExecuted: true`
   - `commitAllowed: false`
   - `persistedRowsAfterRollback: 0`

## Riesgos y límites

- Si tablas objetivo tienen columnas NOT NULL sin default desconocidas por el ensayo, la inserción puede fallar.
- El ensayo asume uso de tablas permitidas: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.
- v038 no reemplaza una migración productiva; solo valida la ruta de seguridad rollback-only.

## Siguiente fase recomendada

**v039**: endurecer mapeo de columnas por entorno y agregar validación de compatibilidad previa a la transacción (preflight), manteniendo rollback-only como guardrail antes de habilitar cualquier write gate superior.

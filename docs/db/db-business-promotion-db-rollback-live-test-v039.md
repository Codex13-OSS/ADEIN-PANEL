# v039 — Business Promotion DB Rollback Live Test Harness

## Qué es v039

v039 agrega una capa estricta de **live test harness** para validar una ejecución controlada contra MariaDB usando exclusivamente transacción con **ROLLBACK obligatorio**. Esta fase no migra datos, no habilita flujo productivo y no deja persistencia.

## Diferencia entre v038 y v039

- **v038**: rehearsal rollback-only enfocado en preparación y verificación local de patrón transaccional.
- **v039**: agrega gates explícitos de live test, validación más estricta de entorno/BD y evidencia antes/después para demostrar `persistedRowsAfterRollback: 0`.

## Garantías de seguridad de v039

- No usa `connection.commit(` ni rutas `.commit(` ejecutables.
- No ejecuta `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `DELETE` ni `UPDATE`.
- Solo permite `INSERT` dentro de transacción seguida de `ROLLBACK`.
- Solo usa datos ficticios con tokens `REHEARSAL_V039_`, `ADEIN_V039_ROLLBACK_TEST_` y `example.invalid`.
- No usa datos reales ni credenciales hardcodeadas.

## Variables necesarias

### Gates explícitos (obligatorios para live test)

- `ADEIN_DB_ROLLBACK_LIVE_TEST=1`
- `ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V039`
- `ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1`

### Conexión (solo por entorno)

- `ADEIN_DB_HOST`
- `ADEIN_DB_PORT`
- `ADEIN_DB_USER`
- `ADEIN_DB_PASSWORD`
- `ADEIN_DB_NAME`

## Comandos

### Modo default (sin BD)

```bash
npm run db:business-promotion:db-rollback-live-test
```

Debe responder en `dry_run` sin fallar.

### Self-check (sin BD)

```bash
npm run db:business-promotion:db-rollback-live-test:self-check
```

Valida existencia de archivos, scripts npm, comportamiento `dry_run`, rechazo sin gates y cumplimiento de restricciones técnicas.

## Ejemplo seguro con placeholders (sin credenciales reales)

```bash
ADEIN_DB_ROLLBACK_LIVE_TEST=1 \
ADEIN_DB_WRITE_GATE=ROLLBACK_ONLY_V039 \
ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS=1 \
ADEIN_DB_HOST="127.0.0.1" \
ADEIN_DB_PORT="3306" \
ADEIN_DB_USER="<db_user_placeholder>" \
ADEIN_DB_PASSWORD="<db_password_placeholder>" \
ADEIN_DB_NAME="<db_name_placeholder>" \
npm run db:business-promotion:db-rollback-live-test
```

## Ejecución futura por túnel SSH o servidor

1. Abrir túnel SSH hacia el servidor de BD (si aplica).
2. Exportar variables en shell segura del operador (no en repo).
3. Ejecutar el comando live test.
4. Guardar JSON de salida como evidencia de auditoría interna.

## Interpretación de `persistedRowsAfterRollback: 0`

- Significa que, tras `ROLLBACK`, no quedaron filas persistidas vinculadas al token de prueba v039 en tablas objetivo:
  - `clients`
  - `properties`
  - `lots`
  - `contracts`
  - `payment_schedule`

## Riesgos y límites

- Si los metadatos de tablas cambian, el script puede rechazar inserciones demo por columnas no resolubles.
- v039 no reemplaza pruebas productivas supervisadas; solo valida rollback-only controlado.
- No realiza migración ni saneamiento de datos reales.

## Siguiente fase recomendada

Proponer una fase posterior enfocada en **observabilidad operativa** del ensayo (captura centralizada de reportes JSON, trazabilidad de ejecución y controles de ventana operativa), manteniendo política estricta de no-commit para pruebas.

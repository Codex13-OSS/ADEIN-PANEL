# v032 - Migration Execution Dry-Run / Write Guard

## Qué resuelve v032
Esta fase implementa una capa de simulación segura para planes de migración CRM sin ejecutar escrituras reales.

## Principios de seguridad
- `mode = dry_run`
- `writesEnabled = false`
- `executed = false`
- No escribe en BD.
- No ejecuta operaciones destructivas.
- No migra datos reales.
- Usa fixture demo seguro.

## Scripts incluidos
- `npm run db:migration:dry-run`
  - Ejecuta el resumen de un plan de migración demo (o `--input` opcional).
  - Entrega conteos por entidad en `wouldCreate`.
- `npm run db:migration:dry-run:self-check`
  - Verifica fixture, salida esperada de guardias dry-run y ausencia de patrones peligrosos.

## Qué salida esperar
- Objeto `guard` con:
  - `mode: "dry_run"`
  - `writesEnabled: false`
  - `executed: false`
  - `databaseWritesAttempted: false`
  - `destructiveOperationsAllowed: false`
- Objeto `wouldCreate` con conteos y `sampleRefs` por entidad.
- Objeto `validations` con `ok`, `errors`, `warnings`.

## Qué NO hace esta fase
- No se conecta para escribir en MariaDB.
- No ejecuta `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `TRUNCATE`, `DROP` ni `ALTER`.
- No crea migraciones reales ejecutables.
- No promueve datos a tablas productivas.

## Relación con fases siguientes
- **v033**: persistencia controlada de `import_batches`/`import_raw_rows` con write gate explícito.
- **v034**: migration plan real a BD.
- **v035**: promoción controlada a `clients`/`properties`/`lots`/`contracts`/`payment_schedule`.
- **v036**: dashboard read-only con datos reales migrados.
- **v037+**: IA read-only solo como analista, sin ejecutar acciones.

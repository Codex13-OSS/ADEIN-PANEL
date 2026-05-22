# DB Business Promotion Write Rehearsal v037

## Qué hace v037

v037 implementa una **capa de seguridad de ensayo de escritura** (write rehearsal) para la promoción lógica de negocio usando únicamente datos demo y validaciones estructurales.

- Reutiliza el plan lógico por orden: `clients -> properties -> lots -> contracts -> payment_schedule`.
- Valida relaciones obligatorias:
  - `property -> client`
  - `lot -> property`
  - `contract -> client + lot`
  - `payment_schedule -> contract`
- Restringe alcance a tablas permitidas:
  - `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.
- Emite salida JSON con banderas de seguridad (`commitAllowed: false`, rollback flags, checks, blockers, warnings).

## Qué NO hace v037

- No migra datos reales.
- No ejecuta commit.
- No deja persistencia de datos.
- No modifica esquema SQL.
- No conecta frontend con escritura.
- No toca `auth/login/mobile/documentos`.

## Diferencia entre v035, v036 y v037

- **v035**: write gate dry-run de promoción de negocio.
- **v036**: transaction preview lógico de operaciones y conflictos.
- **v037**: write rehearsal con capa explícita de rollback safety y bloqueo de commit real.

## Modos de ejecución

### Default (requerido): dry-run sin BD

Por defecto:

- `mode: "dry_run"`
- `databaseMode: "none"`
- `writesEnabled: false`
- `rollbackRequired: false`
- `rollbackExecuted: false`
- `commitAllowed: false`

No requiere credenciales ni conexión de base de datos.

### Modo opcional con BD (solo rollback-only)

Existe soporte opcional para modo de ensayo con BD **solo si** se habilitan gates explícitos de entorno. Si faltan gates, el script rechaza el modo BD y vuelve a dry-run seguro.

En caso de activación válida:

- `databaseMode: "rollback_only"`
- `rollbackRequired: true`
- `rollbackExecuted: true`
- `commitAllowed: false`

## Comandos

```bash
npm run db:business-promotion:rehearsal
npm run db:business-promotion:rehearsal:self-check
```

## Validaciones esperadas

- El script corre sin BD en modo default.
- `ok === true` y `phase === "v037"`.
- `writesEnabled === false` y `commitAllowed === false` por defecto.
- Orden de pasos correcto.
- Relaciones obligatorias validadas.
- Escenario inválido genera blockers.
- El modo BD no se activa sin gates explícitos.
- No se usan nombres legacy (`adein.crm.v1`, `adein.imports.v1`).

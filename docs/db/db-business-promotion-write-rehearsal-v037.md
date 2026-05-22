# DB Business Promotion Write Rehearsal v037

## Qué hace v037

v037 implementa una capa de ensayo de escritura (write rehearsal) para promoción lógica sin migrar datos reales.

- Orden validado: `clients -> properties -> lots -> contracts -> payment_schedule`.
- Relaciones validadas: `property -> client`, `lot -> property`, `contract -> client + lot`, `payment_schedule -> contract`.
- Scope permitido: `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.

## Qué NO hace v037

- No migra datos reales.
- No ejecuta commit.
- No deja datos persistidos.
- No modifica schema SQL.

## Diferencia v035 vs v036 vs v037

- v035: write gate dry-run.
- v036: transaction preview lógico.
- v037: write rehearsal con safety layer de rollback-only y `commitAllowed: false`.

## Modo default

- `mode: "dry_run"`
- `databaseMode: "none"`
- `writesEnabled: false`
- `rollbackRequired: false`
- `rollbackExecuted: false`
- `commitAllowed: false`

## Modo opcional con BD

Solo con gates explícitos; si faltan, se rechaza y permanece dry-run seguro.

## Comandos

```bash
npm run db:business-promotion:rehearsal
npm run db:business-promotion:rehearsal:self-check
```

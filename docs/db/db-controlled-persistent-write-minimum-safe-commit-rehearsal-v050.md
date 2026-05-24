# v050 — Controlled Persistent Write Minimum Safe Commit Rehearsal

## Qué implementa v050
La fase **v050** implementa un rehearsal mínimo seguro para un futuro commit controlado, con ejecución en modo dry-run y salida JSON verificable.

## Por qué NO hace escritura persistente
En v050 se mantiene un sobre de seguridad estricto:
- No habilita escrituras persistentes.
- No autoriza commit real.
- No requiere conexión a base de datos por defecto.
- No usa datos reales ni credenciales.

## Relación con v042, v048 y v049
- **v042**: evidencia de rollback-only real aprobado.
- **v048**: evidencia de rehearsal de escritura real controlada.
- **v049**: evidencia de planning/candidate para escritura persistente controlada.

v050 toma estas evidencias como precondiciones para un ensayo de “minimum safe commit” sin ejecutar cambios reales.

## Evidencia que prepara v050
- Estructura explícita de tablas permitidas.
- Orden de inserción relacional propuesto.
- Conteos esperados para rehearsal.
- Precondiciones requeridas.
- Condiciones de aborto.
- Gates futuros necesarios para fase explícita de commit real.
- Approval artifact candidate (inválido para commit real en v050).

## Gates para una fase futura (NO autorizan en v050)
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE`
- `ADEIN_DB_WRITE_GATE`
- `ADEIN_DB_APPROVAL_TOKEN`
- `ADEIN_DB_COMMIT`
- `ADEIN_DB_BACKUP_CONFIRMED`
- `ADEIN_DB_SNAPSHOT_CONFIRMED`

## Qué está prohibido
- Cualquier escritura persistente real.
- Cualquier commit real.
- Uso de datos reales.
- Uso/carga de credenciales para conectar BD por defecto.
- Uso de tablas fuera de `clients`, `properties`, `lots`, `contracts`, `payment_schedule`.

## Cómo correr
```bash
npm run db:controlled-write:minimum-safe-commit-rehearsal
npm run db:controlled-write:minimum-safe-commit-rehearsal:self-check
```

## Criterios de aceptación
- Script principal responde JSON válido.
- Caso normal: `ok=true`, `commitAllowed=false`, `commitExecuted=false`, `persistentWriteExecuted=false`.
- Casos peligrosos: bloqueo explícito con `ok=false`, `blocked=true`, exit code 1.
- Self-check valida caso positivo y todos los casos negativos definidos.

## Checklist para cerrar v050
- [ ] Script principal creado y ejecutable por npm script.
- [ ] Self-check creado y validando escenarios positivos/negativos.
- [ ] Bloqueos por env peligrosa activos.
- [ ] Sin escritura persistente ni commit real.
- [ ] Sin conexión BD por defecto.
- [ ] Sin datos reales ni credenciales.
- [ ] Documentación v050 publicada.

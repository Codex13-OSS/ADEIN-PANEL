# v058 — Minimum Persistent Write Approval Artifact / Human Authorization Gate

## ¿Qué es v058?

v058 define una fase **artifact-only** para documentar y bloquear cualquier intento de escritura persistente real en BD.

Esta fase existe para preparar una **futura** fase de escritura mínima persistente, pero **sin implementarla** en v058.

## ¿Qué significa artifact-only en v058?

El script de v058:

- genera un JSON de artifact con evidencia requerida y gates humanos;
- ejecuta en `dryRun: true` por defecto;
- no conecta a base de datos;
- no abre transacciones;
- no ejecuta COMMIT;
- no realiza escrituras persistentes.

## Evidencia requerida

v058 exige evidencia previa:

1. **v056.1 controlled read-only row counts fix**
   - tag: `v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix`
   - head: `a3dce91`
   - row counts requeridos en `0` para:
     - `clients`
     - `properties`
     - `lots`
     - `contracts`
     - `payment_schedule`

2. **v057 controlled transaction rollback rehearsal**
   - tag: `v0.1.48-adein-crm-controlled-transaction-rollback-rehearsal`
   - head: `3eceb82`
   - rollback-only exitoso requerido
   - `postRollbackVerified: true` requerido

3. **backup v054 requerido**
   - path:
     `/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql`
   - sha256:
     `3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d`

## Gates humanos para fase futura

La fase futura (v059 o posterior) debe requerir explícitamente:

- autorización humana separada y explícita;
- verificación fresca de backup;
- verificación fresca de row counts;
- rollback rehearsal fresco **o** decisión explícita de depender de evidencia v057;
- prohibición de uso de datos reales de clientes.

Además, la propuesta de escritura mínima futura está limitada a datos sintéticos:

- 1 property sintética;
- 1 lot sintético asociado a property;
- 1 client sintético;
- 1 contract sintético asociado a client/property/lot;
- 1 payment_schedule sintético asociado a contract.

## Variables peligrosas bloqueadas

Si se detecta cualquiera de estas señales, v058 **aborta** con JSON válido `ok:false` y exit code `1`:

- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_WRITES_ENABLED=true`
- `ADEIN_DB_MODE=write`
- `ADEIN_DB_MODE=read_write`
- `ADEIN_DB_MODE=persistent_write`
- `ADEIN_DB_WRITE_GATE=REAL_COMMIT`
- `ADEIN_DB_WRITE_GATE=V058_REAL_COMMIT`
- `ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT`
- `ADEIN_V058_EXECUTE_COMMIT=1`

## Cómo correr

```bash
npm run db:minimum-write:approval-artifact
npm run db:minimum-write:approval-artifact:self-check
```

## Qué NO hace v058

v058 **no**:

- ejecuta conexión a DB;
- abre transacción persistente;
- ejecuta COMMIT real;
- agrega rutas funcionales de COMMIT real;
- ejecuta SQL de escritura o cambios de schema;
- usa datos reales;
- modifica producción o PM2.

## Criterios para pasar a v059

Para habilitar una fase v059 (o posterior) con ejecución real, debe existir:

- especificación separada aprobada por humano;
- gates de seguridad activos y auditables;
- validación de evidencia fresca (backup + row counts + rollback posture);
- implementación nueva separada de v058.

v058 se mantiene estrictamente como fase de artifact y autorización humana previa.

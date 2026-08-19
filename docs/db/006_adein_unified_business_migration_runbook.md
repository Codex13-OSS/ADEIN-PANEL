# ADEIN 006 — Migración unificada de negocio

## Línea canónica

`004 → 005 → 006`

`001_initial_schema.sql` se conserva como antecedente histórico. Su dominio de negocio
no solapado fue incorporado a `006`; no vuelve a ejecutarse como una segunda línea
de bootstrap.

## Ambientes

La estructura SQL es común.

- Local: `adein_crm_dev`, datos de desarrollo/prueba.
- Producción: base configurada para producción, datos reales.
- No existe sincronización automática de datos entre ambientes.

## Cold start

En un volumen MariaDB vacío, Docker ejecuta en orden:

1. `004_adein_local_lead_agent_schema.sql`
2. `005_commercial_intelligence_v1.sql`
3. `006_adein_unified_business_schema.sql`

En volúmenes existentes, `docker-entrypoint-initdb.d` no vuelve a ejecutar migraciones.
Por eso `006` dispone de tooling explícito para actualización controlada.

## Seguridad del apply

`006` opera en `dry_run` por defecto y no conecta a MariaDB.

Un apply local sólo puede avanzar cuando existen simultáneamente:

- `ADEIN_006_MODE=apply`
- `ADEIN_006_APPLY=1`
- `ADEIN_006_APPROVAL=APPROVE_ADEIN_006_LOCAL`
- `ADEIN_DB_TARGET=local_docker`
- estrategia local `docker exec`, sin publicar MariaDB al host
- contenedor permitido `adein-release-test-db-1`
- Compose project `adein-release-test`
- Compose service `db`
- base `adein_crm_dev`
- backup previo existente
- SHA256 exacto de ese backup

Producción está bloqueada por este tooling.

## Backup obligatorio

Antes del primer apply sobre una BD local persistente debe generarse un dump completo
de `adein_crm_dev`, fuera del repositorio, y calcularse su SHA256.

El backup no debe contenerse en Git.

## Rollback

MariaDB puede hacer commit implícito de DDL; por ello no se considera suficiente un
`ROLLBACK` transaccional para esta migración.

La ruta de rollback es restaurar el backup completo previo a `006`.

La restauración:

- nunca es automática;
- nunca se ejecuta como consecuencia directa de un error del migrador;
- requiere autorización humana explícita;
- debe verificar previamente el SHA256 del backup;
- sólo puede dirigirse al ambiente local durante esta fase.

## Orden antes de escribir

1. Schema y arquitectura definidos.
2. Static self-check PASS.
3. Dry-run PASS.
4. Cold-start lineage preparado.
5. Tooling de apply protegido por gates.
6. Backup local real + SHA256.
7. Verificación de restaurabilidad.
8. Autorización humana explícita.
9. Apply únicamente local.
10. Post-check de tablas y relaciones.

Producción queda fuera de alcance hasta una autorización posterior independiente.

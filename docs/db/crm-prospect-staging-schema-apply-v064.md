# CRM Prospect Staging Schema Apply v064

## Qué hace
- Ejecuta **dry-run por defecto** para validar el SQL `docs/db/003_crm_prospect_staging_schema_v063.sql` sin conectarse a BD.
- Verifica que solo se operen tablas allowlist:
  - `lead_sources`
  - `prospects`
  - `whatsapp_conversations`
  - `whatsapp_analyses`
  - `prospect_followups`
  - `crm_history_events`
- Rechaza patrones peligrosos: `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, `REPLACE`, `CREATE DATABASE`, `USE`, `GRANT`, `ALTER USER`, `DROP USER`, `SET PASSWORD`.
- Emite JSON estructurado con plan de apply/verificación y notas de rollback manual.

## Qué NO hace
- No inserta prospectos reales ni datos de campaña.
- No llama APIs reales (OpenAI/Facebook/WhatsApp).
- No toca producción.
- No toca tablas de negocio `clients`, `contracts`, `payment_schedule`, `lots`.
- No ejecuta rollback automático destructivo.

## Dry-run
```bash
npm run crm:prospect-staging:schema-apply
```

## Self-check
```bash
npm run crm:prospect-staging:schema-apply:self-check
```

## Apply controlado en staging (solo autorizado)
Requiere gates explícitos:
- `ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064=1`
- `ADEIN_DB_ENV_FILE=/ruta/archivo.env`
- `ADEIN_DB_TARGET=staging`

Ejemplo:
```bash
ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064=1 \
ADEIN_DB_TARGET=staging \
ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db-staging.env \
npm run crm:prospect-staging:schema-apply
```

## Abort conditions
El script aborta si detecta:
- `NODE_ENV=production`
- `ADEIN_DB_TARGET=production`
- `ADEIN_DB_ENV=production`
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- Falta de gates requeridos para apply.

## Verificación esperada post-apply
- Las 6 tablas allowlist existen en el schema destino.
- Row counts reportados para las 6 tablas (idealmente `0` en staging limpio).
- Sin afectación a tablas de negocio (`clients`, `contracts`, `payment_schedule`, `lots`).

## Rollback notes (MariaDB/MySQL DDL)
- DDL no garantiza rollback transaccional completo en MariaDB/MySQL.
- Rollback debe ser manual/controlado: restauración desde backup validado o DDL inverso revisado.
- v064 no ejecuta `DROP` automático como rollback.

## Seguridad funcional
- Dry-run por defecto.
- Sin inserción de prospectos reales.
- Sin migración a tablas de negocio.
- Sin exposición de credenciales en código.

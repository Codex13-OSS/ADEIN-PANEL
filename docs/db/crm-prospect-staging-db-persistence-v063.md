# CRM Prospect Staging DB Schema + Dry-Run Persistence Plan (v063)

## Objetivo
Preparar un esquema de staging para persistencia futura de prospectos de campaña (especialmente WhatsApp .txt) sin ejecutar escrituras reales en MariaDB durante v063.

## Por qué **no** usamos `clients` todavía
`clients` representa clientes formales/confirmados. Un lead inicial aún puede estar incompleto o en validación, por lo que mezclarlo con `clients` genera riesgo de contaminación operativa y de procesos formales (contratos, cobranza, calendario de pagos).

## Por qué `crm_followups` actual no sirve para prospectos iniciales
En `docs/db/001_initial_schema.sql`, `crm_followups` exige `client_id NOT NULL` con FK a `clients(id)`. Esto fuerza la conversión prematura del lead a cliente formal, lo cual contradice el flujo de staging de prospectos.

## Propuesta de tablas v063 (documental)
Archivo: `docs/db/003_crm_prospect_staging_schema_v063.sql`

1. `lead_sources`
2. `prospects`
3. `whatsapp_conversations`
4. `whatsapp_analyses`
5. `prospect_followups`
6. `crm_history_events`

Todas incluyen un enfoque conservador/auditable:
- PK `id BIGINT UNSIGNED AUTO_INCREMENT`
- `external_ref` / `source_ref` opcionales según entidad
- `source` controlado (`whatsapp_txt`, `manual`, `demo`, `import`)
- `environment` (`staging`, `production`)
- `is_test`, `is_demo`
- `review_status` (`pending`, `approved`, `rejected`)
- `raw_payload_json`, `normalized_payload_json`
- `created_at`, `updated_at`
- FK opcionales a `sellers(id)` y `crm_users(id)`
- `phone_normalized` indexado para deduplicación en `prospects` y `whatsapp_conversations`

## Orden lógico de inserción (solo plan, sin ejecución)
`lead_sources` → `prospects` → `whatsapp_conversations` → `whatsapp_analyses` → `prospect_followups` → `crm_history_events`

## Seguridad v063
- No conexión real obligatoria a BD.
- No `INSERT/UPDATE/DELETE/COMMIT` ejecutables por defecto.
- No escritura en `clients`, `contracts`, `payment_schedule`, `lots`.
- Dry-run con fixture sintético únicamente.

## Qué queda listo para v064
- Contrato de datos de staging para prospectos de campaña.
- Orden de persistencia validado y auditable.
- Punto de partida para habilitar persistencia controlada detrás de gates explícitos.

## Confirmación de alcance v063
Esta versión **NO** escribe en BD; solo propone esquema y genera plan de persistencia en modo `dry_run`.

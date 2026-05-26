# v067.1 - Hotfix de alineación de schema real (staging synthetic persistent write)

## Qué falló en v067
El intento controlado `controlled_persistent_commit_staging` de v067 en Contabo falló durante verificación relacional/token. El flujo estaba preparado correctamente para abortar seguro, pero usaba referencias de columnas no existentes en el schema real de staging (`analysis_token`, `followup_token`, `event_token`).

## Por qué falló de forma segura
- Sí hubo intento de conexión/transacción en el servidor staging.
- La verificación intra-transacción detectó inconsistencia y abortó.
- **No hubo COMMIT** (`commitExecuted=false`).
- **No hubo persistencia** (`persistentWriteExecuted=false`).
- Row counts quedaron sin cambios netos (0 nuevas filas en las 6 tablas objetivo).

## Qué corrige v067.1
v067.1 mantiene el mismo flujo y gates de v067, pero alinea token, verificación y rollback al schema real confirmado de MariaDB staging:

- `lead_sources`: `source_code`, `source_ref`
- `prospects`: `external_ref`, `source_ref`
- `whatsapp_conversations`: `external_ref`, `source_ref`
- `whatsapp_analyses`: `external_ref`, `source_ref`
- `prospect_followups`: `external_ref`, `source_ref`
- `crm_history_events`: `external_ref`, `source_ref`, `event_type`
- JSON sintético trazable en `raw_payload_json` y `normalized_payload_json`

## Columnas prohibidas removidas
- `analysis_token`
- `followup_token`
- `event_token`

## Seguridad y comportamiento esperado
- Default: `dry_run`.
- No conexión a BD por defecto.
- No commit real por defecto.
- Sin datos reales, sin prospectos reales.
- Sin producción.
- Sin OpenAI/IA real, Facebook API real ni WhatsApp API real.
- Sin writes a `clients/contracts/payment_schedule/lots`.

## Validación local (Codex/local)
Ejecutar únicamente:
- `npm run crm:prospect-staging:synthetic-persistent-write`
- `npm run crm:prospect-staging:synthetic-persistent-write:self-check`
- `npm run crm:prospect-staging:synthetic-persistent-write:rollback`
- `npm run build`

En local/Codex no se debe intentar commit real ni rollback real.

## Reintento posterior en staging
El reintento `controlled_persistent_commit_staging` debe ejecutarse **solo en servidor staging controlado**, nunca desde Codex/local, con gates completos v067 y evidencia antes/durante/después (row counts, insertedIds, token, verificación post-commit).

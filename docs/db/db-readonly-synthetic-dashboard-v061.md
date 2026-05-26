# v061 - Snapshot BD read-only sintético para dashboard

## Qué lee v061.1
Se agrega endpoint `GET /api/db/synthetic-dashboard` sobre la API read-only existente.
Solo realiza lecturas `SELECT` de:
- `properties`
- `lots`
- `clients`
- `contracts`
- `payment_schedule`

Filtra por token sintético v060.1: `ADEIN_SYNTHETIC_V060_2026_05_25`.

### Cambio clave v061.1 (schema-aware)
- **No usa** columna `synthetic_token`.
- El filtro se hace por columnas reales textuales y `raw_payload_json` (cuando existe), con `LIKE ?` parametrizado:
  - `properties`: `name`, `raw_payload_json`
  - `lots`: `lot_code`, `raw_payload_json`
  - `clients`: `full_name`, `email`, `notes`, `raw_payload_json`
  - `contracts`: `contract_code`, `raw_payload_json`
  - `payment_schedule`: `notes`, `raw_payload_json`
- Antes de construir cada `WHERE`, el helper consulta `INFORMATION_SCHEMA.COLUMNS` para evitar romper si una columna no existe en el schema real.

## Garantía de no escritura
- `mode: read_only_synthetic_dashboard`
- `writesEnabled: false`
- `syntheticOnly: true`
- No usa `INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER`.
- Mantiene modo `READ-ONLY / STAGING / SINTÉTICO (NO REAL)`.

## Conexión con evidencia v060.1
Este snapshot enlaza el dashboard a los datos persistidos en staging ejecutados en v060.1 (token sintético indicado arriba).
Evidencia operativa externa:
`/root/adein-backups/adein_crm/v060/2026-05-25T23-44-45-v060-1/controlled_synthetic_persistent_write_v060_1.json`

## Endpoint
`GET /api/db/synthetic-dashboard`

Respuesta esperada (resumen):
- `ok`
- `mode`
- `writesEnabled`
- `database`
- `syntheticOnly`
- `syntheticToken`
- `counts`
- `relationship.property/lot/client/contract/paymentSchedule`
- `warnings`

## UI
Desde Configuración:
1. Definir URL base de API read-only.
2. Click en **Cargar datos sintéticos BD**.
3. Validar y aplicar snapshot.

En Owner Dashboard aparece tarjeta compacta:
- Snapshot BD read-only
- Estado: `READ-ONLY / STAGING / SYNTHETIC`
- Alerta: `NO REAL`
- Conteos y relación sintética.

## Validación local/staging
```bash
npm run build
npm run db:readonly-synthetic-dashboard:self-check
npm run db:api:self-check
```

## Siguiente fase sugerida
- Expandir flujo read-only sintético a panel CRM beta completo.
- O preparar importación real controlada con gates y evidencia formal antes de habilitar cualquier write.

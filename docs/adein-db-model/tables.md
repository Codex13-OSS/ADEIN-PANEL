# Catálogo de Tablas Propuesto

## Convenciones generales
- PK sugerida: `id` (UUID o bigint autoincremental según motor).
- Fechas de auditoría: `created_at`, `updated_at`.
- Trazabilidad de origen (si aplica): `source_file`, `source_sheet`, `source_row`.
- Ambigüedad: `review_required` (boolean) + `review_notes`.

## Sistema

### `users`
- **Propósito**: Identidad técnica para autenticación/sesión.
- **Campos clave sugeridos**: `id`, `username`, `email`, `password_hash`, `status`, `last_login_at`.
- **Relaciones**: 1:N con `audit_log` (actor técnico).
- **Nota**: No representa automáticamente al vendedor real.

### `sellers`
- **Propósito**: Responsable comercial/cobranza real.
- **Campos clave**: `id`, `name`, `code`, `phone`, `status`.
- **Relaciones**: 1:N con `prospects`, `followups`, `clients`, `payments`.
- **Nota**: Debe separarse de `users` para soportar cuentas compartidas.

## CRM / Comercial

### `prospects`
- **Propósito**: Leads/prospectos en fase comercial inicial.
- **Campos clave**: `id`, `name`, `phone_primary`, `phone_original`, `interest`, `budget_range`, `status`, `seller_id`, `source_id`.
- **Relaciones**: N:1 con `sellers`, N:1 con `lead_sources`, 1:N con `followups`.
- **Auditoría**: conservar snapshots de captura inicial.

### `followups`
- **Propósito**: Acciones de seguimiento comercial.
- **Campos clave**: `id`, `prospect_id`, `seller_id`, `due_at`, `completed_at`, `status`, `notes`.
- **Relaciones**: N:1 con `prospects`, N:1 con `sellers`.
- **Auditoría**: cambios de estado en `crm_history_events`.

### `crm_history_events`
- **Propósito**: Bitácora de eventos CRM (ej. `prospect_created`, `followup_created`, `followup_completed`).
- **Campos clave**: `id`, `event_type`, `entity_type`, `entity_id`, `payload_json`, `occurred_at`, `actor_user_id`, `responsible_seller_id`.
- **Relaciones**: N:1 opcional con `users` y `sellers`.
- **Nota**: mantener compatibilidad conceptual con historial local del MVP.

### `whatsapp_conversations`
- **Propósito**: Conversaciones importadas (.txt al inicio; API futura).
- **Campos clave**: `id`, `channel`, `participant_name`, `participant_phone_original`, `messages_raw`, `captured_at`, `source_file`.
- **Relaciones**: 1:N con `whatsapp_analyses`, N:1 opcional con `prospects`.
- **Auditoría**: no alterar `messages_raw`.

### `whatsapp_analyses`
- **Propósito**: Resultado estructurado del análisis (parser local / IA futura).
- **Campos clave**: `id`, `conversation_id`, `analysis_version`, `intent`, `interest_level`, `suggested_next_action`, `suggested_message`, `review_required`.
- **Relaciones**: N:1 con `whatsapp_conversations`.
- **Nota**: preservar trazabilidad entre raw y extracción.

### `campaigns`
- **Propósito**: Gestión de campañas comerciales.
- **Campos clave**: `id`, `name`, `status`, `start_date`, `end_date`, `budget`.
- **Relaciones**: 1:N con `lead_sources`, 1:N opcional con `prospects`.

### `lead_sources`
- **Propósito**: Catálogo de fuentes de lead (campaña, orgánico, referido).
- **Campos clave**: `id`, `name`, `campaign_id`, `status`.
- **Relaciones**: N:1 con `campaigns`, 1:N con `prospects`.

## Inmobiliario / Operativo

### `clients`
- **Propósito**: Persona que ya está en ciclo contractual/cobranza.
- **Campos clave**: `id`, `name`, `phone_primary`, `phone_secondary`, `phone_original`, `address_raw`, `status`, `seller_id`.
- **Relaciones**: N:1 con `sellers`, 1:N con `contracts`, 1:N con `payments`.
- **Nota**: cliente continúa después de compra.

### `properties`
- **Propósito**: Catálogo de predios/proyectos.
- **Campos clave**: `id`, `name`, `location_reference`, `status`.
- **Relaciones**: 1:N con `lots`.

### `lots`
- **Propósito**: Inventario de lotes por predio/manzana.
- **Campos clave**: `id`, `property_id`, `lot_number`, `block`, `internal_number`, `status`.
- **Relaciones**: N:1 con `properties`, 1:N con `contracts`.

### `contracts`
- **Propósito**: Acuerdo de compra del lote.
- **Campos clave**: `id`, `client_id`, `lot_id`, `contract_date`, `total_price`, `status`, `last_paid_installment_snapshot`.
- **Relaciones**: N:1 con `clients`, N:1 con `lots`, 1:N con `payment_schedule`.

### `payment_schedule`
- **Propósito**: Calendario programado de pagos (letras/pagarés).
- **Campos clave**: `id`, `contract_id`, `installment_number`, `due_date`, `amount`, `current_month_snapshot`, `status`.
- **Relaciones**: N:1 con `contracts`, 1:N con `payments` (opcional según implementación).

### `payments`
- **Propósito**: Pagos efectivamente realizados.
- **Campos clave**: `id`, `contract_id`, `schedule_id`, `paid_at`, `amount_paid`, `interest_amount`, `payment_method`, `collector_seller_id`.
- **Relaciones**: N:1 con `contracts`, N:1 con `payment_schedule`, N:1 con `sellers`.

### `collection_status`
- **Propósito**: Estado agregado de cobranza por contrato/cliente.
- **Campos clave**: `id`, `contract_id`, `paid_accumulated`, `pending_balance`, `paid_percentage`, `next_due_date`, `next_due_amount`, `overdue_count`, `risk_level`.
- **Relaciones**: N:1 con `contracts`.
- **Nota**: tabla materializada o vista persistida según estrategia técnica.

### `document_deliveries`
- **Propósito**: Trazabilidad de documentos entregados (contrato, pagaré, anexos).
- **Campos clave**: `id`, `contract_id`, `document_type`, `delivery_channel`, `delivered_at`, `delivery_status`, `metadata_json`.
- **Relaciones**: N:1 con `contracts`.

## Migración / Auditoría

### `import_batches`
- **Propósito**: Control por lote de importación histórica.
- **Campos clave**: `id`, `source_file`, `imported_at`, `imported_by_user_id`, `row_count`, `status`, `notes`.
- **Relaciones**: 1:N con `import_raw_rows`.

### `import_raw_rows`
- **Propósito**: Almacenamiento inmutable de filas raw del origen.
- **Campos clave**: `id`, `batch_id`, `source_file`, `source_sheet`, `source_row`, `raw_payload`, `normalized_payload`, `review_required`, `dedupe_key`.
- **Relaciones**: N:1 con `import_batches`.
- **Nota crítica**: no borrar ni sobrescribir `raw_payload`.

### `audit_log`
- **Propósito**: Registro transversal de cambios/acciones.
- **Campos clave**: `id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `actor_user_id`, `responsible_seller_id`, `occurred_at`.
- **Relaciones**: N:1 opcional con `users` y `sellers`.
- **Nota crítica**: obligatorio para cambios en históricos.

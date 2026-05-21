# Mapeo Excel Histórico → Modelo de BD

## Objetivo
Traducir fuentes históricas (Excel/PDF previamente analizadas fuera del repo) hacia un modelo normalizado sin perder trazabilidad.

## Principio base
Cada fila importada debe generar:
1. Registro raw inmutable en `import_raw_rows.raw_payload`.
2. Registro normalizado parcial/total en tablas de dominio.
3. Referencias `source_file`, `source_sheet`, `source_row`.

## Mapeo conceptual de columnas históricas

| Columna histórica | Destino principal | Destino alterno/contextual | Regla |
|---|---|---|---|
| Fuente | `lead_sources.name` | `import_raw_rows.raw_payload` | Catálogo normalizado + conservar texto original. |
| Cobro | `collection_status.risk_level`/estado | `payments.notes` | Interpretar por contexto de hoja. |
| Predio | `properties.name` | `prospects.interest` | Normalizar nombre y conservar raw. |
| Lote / LT | `lots.lot_number` | `contracts.notes` | Mantener formato original en raw. |
| Manzana / MZ | `lots.block` | `import_raw_rows.raw_payload` | Estandarizar abreviaturas. |
| Num | `lots.internal_number` | `lots.historical_number` (si aplica) | No perder valor legado. |
| Cliente | `clients.name` | `prospects.name` | Depende etapa (prospecto vs cliente). |
| Teléfono 1 | `clients.phone_primary` | `prospects.phone_primary` | Normalizar y conservar raw. |
| Teléfono 2 | `clients.phone_secondary` | `prospects.phone_secondary` | Opcional si existe dato. |
| Teléfono original | `clients.phone_original` | `import_raw_rows.raw_payload` | Nunca perder formato original. |
| Última letra pagada | `contracts.last_paid_installment_snapshot` | `payments` | Snapshot o reconstrucción de pagos. |
| Mes en curso | `payment_schedule.current_month_snapshot` | `collection_status` | Valor de contexto temporal. |
| Valor letra | `payment_schedule.amount` | `contracts.installment_base_amount` | Número monetario normalizado. |
| Intereses | `payments.interest_amount` | `collection_status.interest_due` | Separar interés pagado vs debido. |
| Dirección | `clients.address_raw` | `import_raw_rows.raw_payload` | Guardar texto completo sin truncar. |
| Num letra | `payment_schedule.installment_number` | `payments.reference` | Convertir a entero cuando aplique. |
| Observaciones | `clients.notes`/`contracts.notes` | `import_raw_rows.raw_payload` | Conservar completo sin limpieza destructiva. |
| Vendedor | `sellers.name` | `audit_log.responsible_seller_id` | Normalizar catálogo de vendedores. |
| Responsable seguimiento | `followups.seller_id` | `prospects.seller_id` | Responsable operativo. |
| Fecha de pago | `payments.paid_at` | `payment_schedule.due_date` | Contexto define si fue pago o vencimiento. |
| Fecha de contrato | `contracts.contract_date` | `document_deliveries.delivered_at` | Fecha legal base del contrato. |
| Costo lote | `contracts.total_price` | `lots.reference_price` | Monetario estandarizado. |
| Estatus | `prospects.status`/`lots.status`/`contracts.status` | `collection_status.risk_level` | Mapear por tipo de entidad. |
| Último contacto | `followups.completed_at` | `crm_history_events.occurred_at` | Evidencia de actividad comercial. |
| Próximo seguimiento | `followups.due_at` | `collection_status.next_due_date` | Diferenciar comercial vs cobranza. |
| Notas seguimiento | `followups.notes` | `crm_history_events.payload_json` | Conservar semántica original. |

## Normalización recomendada
- Teléfonos: almacenar `phone_original` y `phone_normalized` (ejemplo: `55 0000 0000` → `5500000000`).
- Fechas: convertir a ISO (`YYYY-MM-DD`) y conservar valor raw si no parsea.
- Monedas: convertir a decimal con 2 decimales y conservar literal raw.
- Estatus: mapear a catálogos controlados, guardando etiqueta original en raw.

## Ambigüedad y `review_required`
Marcar `review_required = true` cuando:
- una columna puede mapear a múltiples entidades sin contexto confiable,
- hay conflicto de identificación (mismo teléfono para diferentes nombres),
- formatos de fecha/moneda son inconsistentes,
- el estado no coincide con pagos registrados.

## Ejemplo ficticio de transformación raw → normalizado

**Raw (import_raw_rows.raw_payload)**
- Cliente: "Cliente Demo"
- Teléfono 1: "55 0000 0000"
- Predio: "Predio Demo"
- LT: "Lote 01"
- MZ: "MZ-A"
- Valor letra: "$2,500"
- Observaciones: "Quiere pagar los días 15"

**Normalizado (tablas dominio)**
- `clients.name = Cliente Demo`
- `clients.phone_primary = 5500000000`
- `clients.phone_original = 55 0000 0000`
- `properties.name = Predio Demo`
- `lots.lot_number = Lote 01`
- `lots.block = A`
- `payment_schedule.amount = 2500.00`
- `followups.notes = Quiere pagar los días 15`

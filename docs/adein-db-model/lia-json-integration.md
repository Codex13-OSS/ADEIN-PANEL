# Integración con LÍA (`JSON/meta.json`)

## Principio
`JSON/meta.json` de LÍA es una **fuente estructurada confiable** para crear/actualizar registros, pero **no reemplaza la base de datos**.

## Flujo objetivo
1. CRM capta prospecto.
2. Prospecto se convierte en cliente.
3. LÍA genera contrato/pagarés.
4. `JSON/meta.json` contiene datos económicos y calendario.
5. Se sincroniza hacia `clients`, `lots`, `contracts`, `payment_schedule` (y opcionalmente `document_deliveries`).
6. Dashboard refleja cobranza, porcentaje pagado, próximos pagos y alertas.

## Contrato de datos esperado (conceptual)
Campos mínimos esperados desde JSON:
- Identificador documental (`document_id`, `contract_folio` o equivalente).
- Cliente (`name`, `phone`, `address`).
- Predio/lote (`property_name`, `block`, `lot_number`).
- Contrato (`contract_date`, `total_price`, `currency`).
- Calendario (`installments[]` con `number`, `due_date`, `amount`).
- Metadatos (`generated_at`, `generator_version`).

## Estrategia de idempotencia
- Definir clave idempotente por documento (ej. `contract_folio` + hash de contenido).
- Si mismo payload se reimporta: no duplicar contrato ni calendario.
- Si cambia payload: registrar diff en `audit_log` y versionar actualización.

## Trazabilidad
Registrar en cada upsert:
- `source_file = JSON/meta.json`
- `source_sheet = null` (no aplica)
- `source_row = null` (no aplica)
- referencia al lote de importación en `import_batches`.

## Validación previa al upsert
- Verificar campos obligatorios (`client`, `lot`, `total_price`, calendario).
- Verificar consistencia de sumatoria de letras vs total (si aplica).
- Marcar `review_required` cuando existan:
  - fechas inválidas,
  - montos negativos o inconsistentes,
  - lotes inexistentes o duplicados conflictivos.

## Qué guarda JSON vs qué guarda BD
- **JSON/meta.json**: snapshot estructurado del documento generado.
- **BD**: estado operativo consolidado, relacional, auditable e integrable con dashboard.

## Ejemplo ficticio mínimo
- Cliente: Cliente Demo
- Predio: Predio Demo
- Lote: Lote 01
- Responsable: Vendedor A
- Teléfono: 55 0000 0000

Resultado esperado:
- Alta/actualización en `clients`.
- Asociación de lote en `lots`.
- Contrato en `contracts`.
- Calendario en `payment_schedule`.
- Evento de auditoría en `audit_log`.

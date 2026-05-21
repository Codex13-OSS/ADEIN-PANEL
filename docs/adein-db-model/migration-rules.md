# Reglas de Migración Conservadora

## Objetivo
Migrar datos históricos sin pérdida de información, garantizando trazabilidad y reversibilidad lógica.

## Reglas obligatorias
1. No perder información histórica.
2. Conservar dato original/raw.
3. Conservar dato normalizado.
4. Conservar archivo origen.
5. Conservar hoja origen.
6. Conservar fila origen.
7. Conservar observaciones originales.
8. Conservar fuente del dato.
9. Nunca borrar raw.
10. Nunca sobrescribir histórico sin `audit_log`.
11. Duplicados se marcan, no se borran.
12. Teléfonos se normalizan conservando original.
13. Direcciones completas se conservan como raw.
14. Observaciones completas se conservan como raw.
15. Ambigüedad: `review_required = true`.
16. Mantener `source_file`, `source_sheet`, `source_row`.
17. Soportar datos incompletos.
18. Excel histórico es fuente inicial, no base final.
19. BD real reemplaza localStorage como storage principal.
20. JSON continúa como formato de intercambio.
21. CRM nuevo convive con clientes históricos.
22. Cliente continúa en contratos/cobranza tras compra.

## Arquitectura de migración

### `import_batches`
Controla ejecución por lote:
- archivo fuente,
- fecha/hora de importación,
- usuario técnico ejecutor,
- totales (leídas, válidas, con revisión, rechazadas).

### `import_raw_rows`
Contenedor inmutable por fila:
- raw original,
- datos normalizados preliminares,
- flags de revisión,
- clave de deduplicación,
- referencias de origen.

### `audit_log`
Registro de cambios:
- antes/después,
- actor técnico (`user`) y responsable real (`seller`),
- timestamp,
- motivo de cambio.

## Deduplificación no destructiva
- Generar `dedupe_key` por reglas multi-campo (ej. teléfono normalizado + predio + lote).
- Si hay colisión:
  - no borrar,
  - no fusionar automático irreversible,
  - marcar candidatos y enviar a revisión.

## Datos ambiguos e incompletos
- Nunca descartar filas por incompletitud; conservar raw.
- Registrar ausencia de datos clave con estado pendiente.
- Escalar revisión manual cuando el mapeo afecte cobranza o estatus contractual.

## Protección de datos personales
- No publicar datos reales en documentación o ejemplos.
- En entornos de prueba, usar datos sintéticos (Cliente Demo, etc.).
- Definir política de minimización para exportaciones compartidas.

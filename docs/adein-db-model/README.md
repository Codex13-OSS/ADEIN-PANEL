# ADEIN-PANEL v017 — Modelo de Datos (CRM + Inmobiliario + Cobranza)

## Propósito
Este paquete documental define la base de datos objetivo para evolucionar ADEIN-PANEL desde un MVP CRM local (localStorage) hacia una plataforma comercial, inmobiliaria y de cobranza con trazabilidad histórica.

Flujo objetivo del negocio:

**Prospecto → Seguimiento → Separación/Compra → Contrato → Pagarés → Cobranza → % Pagado → Próximos Pagos → Dashboard Ejecutivo**.

## Alcance de v017
- Documentar modelo de datos propuesto para CRM, operación inmobiliaria, cobranza, migración y auditoría.
- Documentar reglas de migración conservadora con preservación de dato raw y dato normalizado.
- Documentar mapeo conceptual Excel histórico → tablas de BD.
- Documentar fuentes de datos para pantallas existentes (sin rediseñar producto).
- Documentar integración futura con `JSON/meta.json` de LÍA como fuente estructurada.

## No alcance de v017
- No se implementa base de datos real en esta versión.
- No se modifica frontend, React, TypeScript, backend o configuración de build.
- No se incorporan archivos Excel/PDF históricos al repositorio.
- No se integra WhatsApp API ni OpenAI en esta fase.

## Estado actual de referencia (base funcional)
Checkpoint: `v0.1.5-adein-crm-history-model`.

MVP actual:
1. Carga de `.txt` de WhatsApp.
2. Parser local sin IA.
3. Revisión editable por vendedor.
4. Guardar prospecto.
5. Crear seguimiento.
6. Completar seguimiento.
7. Registrar historial (`crm_history_events` conceptual).
8. Persistir en localStorage (`adein.crm.v1`).
9. Dashboard/CRM refleja cambios locales.

## Cómo leer este paquete documental
1. `tables.md`: catálogo de tablas, relaciones y notas de auditoría.
2. `excel-mapping.md`: mapeo histórico Excel → BD y normalización.
3. `dashboard-data-sources.md`: tablas que alimentan pantallas actuales.
4. `lia-json-integration.md`: integración CRM ↔ LÍA ↔ BD.
5. `migration-rules.md`: reglas no destructivas de migración.
6. `collection-dashboard.md`: lógica/KPI de cobranza y vista ejecutiva.

## Principios de datos (resumen)
- Nunca perder información histórica.
- Conservar siempre **raw + normalizado**.
- Conservar `source_file`, `source_sheet`, `source_row`.
- Nunca borrar raw.
- Nunca sobrescribir histórico sin `audit_log`.
- Duplicados se marcan, no se borran.
- Ambigüedad debe marcar `review_required`.

## Separación obligatoria: usuario vs vendedor
- **Usuario/sesión**: cuenta técnica de acceso al sistema (`users`).
- **Vendedor/responsable**: persona operativa responsable del ciclo comercial/cobranza (`sellers`).

Se permite operación inicial donde varios vendedores compartan una cuenta técnica, sin perder trazabilidad por responsable real.

## Roadmap documental y técnico (v017 → v024)
- **v017**: Documentación de modelo de BD y reglas de migración.
- **v018**: Dashboard local/histórico con estructura semilla/fixtures limpios.
- **v019**: Importador controlado Excel/CSV con preservación raw.
- **v020**: Implementación de BD real.
- **v021**: Dashboard conectado a BD.
- **v022**: Analítica sin IA (métricas/tendencias/alertas).
- **v023**: Capa IA para análisis avanzado.
- **v024**: Integración WhatsApp Business API.

## Ejemplos ficticios usados
- Cliente Demo
- Predio Demo
- Lote 01
- Vendedor A
- Teléfono: 55 0000 0000

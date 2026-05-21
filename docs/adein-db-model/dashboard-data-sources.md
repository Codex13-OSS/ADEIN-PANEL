# Fuentes de Datos para Pantallas Actuales

## Objetivo
Alinear el modelo de datos con las pantallas existentes, sin rediseñar la interfaz actual.

## Estado actual vs futuro
- **Actual (MVP)**: localStorage (`adein.crm.v1`) alimenta CRM/Dashboard local.
- **Futuro**: BD real como fuente principal; JSON/localStorage quedan como apoyo de intercambio o fallback controlado.

## 1) Dashboard maestro

| Sección UI | Tablas fuente principales | Métricas sugeridas |
|---|---|---|
| Centro de decisiones | `collection_status`, `followups`, `crm_history_events` | alertas críticas abiertas, acciones vencidas |
| Prioridad alta | `followups`, `payment_schedule` | seguimientos urgentes + pagos vencen pronto |
| Riesgo comercial | `collection_status`, `prospects` | contratos en riesgo, prospectos fríos |
| Oportunidad | `prospects`, `campaigns`, `lead_sources` | leads de alto interés sin contacto reciente |
| Recomendación | `whatsapp_analyses`, `followups` | próxima acción sugerida por lead |
| Resumen ejecutivo inteligente | `contracts`, `payments`, `collection_status` | cobranza esperada hoy/semana/mes |
| Embudo comercial visual | `prospects`, `followups`, `clients`, `contracts` | conversión por etapa |
| Rendimiento por vendedor | `sellers`, `prospects`, `followups`, `payments` | conversión y cumplimiento por responsable |

## 2) CRM ventas

| Módulo | Tablas fuente |
|---|---|
| Prospectos | `prospects`, `lead_sources`, `sellers` |
| Analizar WhatsApp | `whatsapp_conversations`, `whatsapp_analyses` |
| Seguimientos | `followups`, `prospects`, `sellers` |
| Acciones recomendadas | `whatsapp_analyses`, `followups`, `crm_history_events` |
| Historial | `crm_history_events` |

## 3) Negocio actual

| Vista | Tablas fuente |
|---|---|
| Clientes actuales | `clients`, `contracts`, `collection_status` |
| Predios | `properties` |
| Manzanas | `lots` (campo `block`) |
| Lotes libres/vendidos/reservados | `lots`, `contracts` |
| Observaciones por predio | `properties`, `lots`, `contracts` (notas) |

## 4) Campañas

| Vista | Tablas fuente | Métrica base |
|---|---|---|
| Campañas activas | `campaigns` | activas por fecha/estatus |
| Mensajes recibidos | `whatsapp_conversations` | volumen por campaña/fuente |
| Leads guardados / Interesados | `prospects` | nuevos por campaña |
| Citas / Separaciones | `followups`, `contracts` | avance comercial |
| Rendimiento por campaña | `campaigns`, `prospects`, `contracts` | conversión por origen |
| Costo por lead | `campaigns`, `prospects` | presupuesto / leads |

## 5) Vendedores

| Vista | Tablas fuente | KPI |
|---|---|---|
| Leads asignados | `prospects`, `sellers` | leads activos por vendedor |
| Seguimientos pendientes | `followups` | pendientes y vencidos |
| Conversión | `prospects`, `clients`, `contracts` | % de avance por etapa |
| Última actividad | `crm_history_events`, `payments` | timestamp última acción |

## 6) Configuración

| Vista | Tablas fuente |
|---|---|
| Empresa | (futura `settings`) |
| Usuarios | `users` |
| Documental externo | `document_deliveries` + integración LÍA |
| IA pendiente | `whatsapp_analyses.analysis_version` |
| WhatsApp API futura | `whatsapp_conversations.channel` |

## Reglas de consistencia para widgets
- Todo widget debe declarar fuente primaria + timestamp de actualización.
- Métricas ejecutivas deben apoyarse en datos auditables (`payments`, `contracts`, `collection_status`).
- Si falta dato, mostrar “pendiente de validación” en vez de inferir silenciosamente.

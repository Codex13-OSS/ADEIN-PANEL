# v076 — Owner/Seller Dashboard UX Cleanup + Simulated TXT Readiness

Fecha: 2026-05-26
Rama: feat/crm-owner-seller-dashboard-ux-txt-readiness-v076
Base: v0.1.70-adein-crm-v074-activation-evidence-pack (c431c51)

## Objetivo
Ajustar la UX del dashboard principal de dueño/vendedor para eliminar lenguaje técnico y presentarlo como demo comercial operativa, dejando explícito el siguiente paso de carga de archivos `.txt` de WhatsApp.

## Cambios implementados
- Encabezado comercial actualizado a **"Panel comercial ADEIN"** con subtítulo orientado a negocio.
- Tarjetas principales simplificadas para usuario final:
  - Prospectos nuevos
  - Conversaciones cargadas
  - Análisis listos
  - Seguimientos pendientes
  - Actividad registrada
- Nuevo bloque **Etapa actual** con mensajes claros de demo simulada y siguiente paso `.txt`.
- Nuevo bloque **Qué podrá ver el vendedor**.
- Nuevo bloque **Qué podrá ver el dueño**.
- Nuevo bloque visual **Carga de conversaciones .txt** (solo readiness visual, sin upload real).
- Se conservaron métricas y estructura de lectura ya existente sin habilitar escrituras ni integraciones reales.

## Seguridad y alcance
- No se tocó producción.
- No se tocó PM2.
- No se tocó base de datos real.
- No se tocaron APIs reales de OpenAI/Facebook/WhatsApp.
- No se tocaron auth/login/mobile/documentos/pagarés/cobranza.
- No se agregaron credenciales.
- Cambios limitados a UX del dashboard + documentación v076.

## Resultado esperado
El dashboard queda entendible para dueño/vendedor como demo comercial con datos simulados, y deja visible la preparación para la siguiente fase de ingestión de conversaciones de WhatsApp en formato `.txt`.

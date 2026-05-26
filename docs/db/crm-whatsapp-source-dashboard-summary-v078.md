# v078 — CRM WhatsApp Source of Truth + Dashboard Summary Cleanup

## Decisión de arquitectura
En v078 se formaliza que **CRM > Analizar WhatsApp** es la fuente única de captura y análisis de conversaciones (`.txt` y texto pegado), y que el **Dashboard maestro** es un resumen ejecutivo para dueño/vendedor.

## Qué cambió
- `OwnerDashboardPage` ya no usa parser/fixture local de v077 ni expone flujo paralelo de análisis.
- Se agregó bloque “Análisis de WhatsApp” con copy explícito:
  - “Los archivos .txt se cargan desde CRM > Analizar WhatsApp.”
  - resumen de último prospecto, próximo seguimiento y CTA.
- Se agregó CTA `Analizar conversaciones en CRM` con callback opcional para abrir CRM en tab WhatsApp.
- `Shell` conecta ese callback en forma local y no invasiva usando estado existente (`activeSection`, `activeCrmTab`).
- `CrmPage` mantiene su flujo existente y solo mejora copy para reforzar que es la fuente de captura.

## Qué no cambió
- Sin endpoints nuevos.
- Sin migraciones.
- Sin cambios en API v069/v071/v074.
- Sin cambios en auth/login/mobile/documentos/pagarés/cobranza.
- Sin cambios en contratos, pagos, cobranza o documentos.
- Sin OpenAI/Facebook/WhatsApp API real.
- Sin escritura real a MariaDB.

## Seguridad de datos y entorno
- Se mantiene el enfoque local/sintético/staging.
- No se usaron datos reales ni credenciales.
- Producción y PM2 quedan fuera de alcance de esta fase.

## Fase sugerida siguiente
- Exponer en Dashboard un resumen agregado desde estado CRM persistido (ya localStorage) con timestamp del último análisis para trazabilidad visual de operación diaria.

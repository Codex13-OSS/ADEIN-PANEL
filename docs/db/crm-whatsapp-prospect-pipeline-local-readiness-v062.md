# v062 - CRM WhatsApp Prospect Pipeline Local/Readiness

## Qué queda listo en v062
- Pipeline local explícito: WhatsApp `.txt` -> análisis -> prospecto -> seguimiento -> historial -> dashboard local.
- Persistencia se mantiene en `localStorage` (`adein.crm.v1`).
- Se agrega capa de readiness local para convertir prospect/followup/history a payload candidato de BD.
- Dashboard separa métricas CRM local activas vs métricas demo/históricas y snapshot read-only aplicado manualmente.
- Se agrega self-check automático: `npm run crm:whatsapp-pipeline:self-check`.

## Qué sigue en v063
- Conectar payload readiness local a contratos de escritura controlada en backend.
- Definir validaciones de esquema MariaDB y mapeo definitivo de campos.
- Agregar trazabilidad de sincronización (local -> API backend) con feature flag.

## Aclaraciones críticas
- v062 **NO escribe en BD**.
- v062 **NO hace INSERT/UPDATE/DELETE/COMMIT**.
- v062 beta puede usarse para campañas en modo local/controlado con `localStorage`.
- Prospectos persistentes en BD real quedan para fase siguiente (v063).

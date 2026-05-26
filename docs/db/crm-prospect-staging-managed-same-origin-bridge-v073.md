# CRM Prospect Staging Managed Same-Origin Bridge v073

## Objetivo
Preparar activación **controlada, manual y reversible** para staging (`3016`) usando same-origin bridge, sin tocar producción (`3006`) ni exponer `3091` públicamente.

## Nuevo alcance v073
- Script de plan (dry-run): `scripts/crm-prospect-staging-managed-same-origin-bridge-plan-v073.mjs`
- Script de self-check: `scripts/crm-prospect-staging-managed-same-origin-bridge-self-check-v073.mjs`
- Scripts npm:
  - `npm run crm:prospect-staging:managed-same-origin-bridge:plan`
  - `npm run crm:prospect-staging:managed-same-origin-bridge:self-check`

## Garantías de seguridad
- No modifica PM2 por defecto.
- No crea procesos persistentes por defecto.
- No ejecuta escritura/commit/transacción.
- Mantiene `productionTouched:false` y `stagingPm2Touched:false`.
- Requiere confirmación explícita para cualquier reemplazo manual de comando PM2 de staging.

## Modelo actual (staging)
- App PM2 esperada: `adein-panel-staging-v052`
- Modo actual esperado: `serve -s /opt/ADEIN-PANEL-staging-v052/dist -l 3016`

## Modelo objetivo (manual)
1. Build frontend con:
   - `VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot`
2. Levantar v069 read-only local en `127.0.0.1:3091` con gates exactos staging/read-only.
3. Cambiar manualmente comando PM2 staging para usar v071 same-origin server en `3016`.
4. Validar health/snapshot/UI.

## Rollback (manual)
1. Detener proceso v071 de staging.
2. Restaurar comando previo:
   - `serve -s /opt/ADEIN-PANEL-staging-v052/dist -l 3016`
3. Detener v069 local API.
4. Verificar 3006/3016 en 200 y sin exposición pública de 3091.

## Validación sugerida
- `curl http://127.0.0.1:3006`
- `curl http://127.0.0.1:3016`
- `curl http://38.242.222.25:3016`
- `curl http://127.0.0.1:3091/health`
- `curl http://127.0.0.1:3016/api/crm/prospect-staging/readonly-snapshot`
- Verificación visual dashboard (fallback -> snapshot API).

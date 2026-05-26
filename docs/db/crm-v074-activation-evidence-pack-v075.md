# ADEIN CRM v075 — v074 Activation Evidence Pack

## 1) Resumen ejecutivo
La activación v074 dejó **staging same-origin en modo read-only** operativo en `3016`, con una API local en `3091` **no expuesta públicamente**, manteniendo **producción en `3006` intacta** y el estado de procesos **persistido con `pm2 save`**.  
Esta fase v075 es exclusivamente documental para consolidar evidencia antes de avanzar a nuevas funcionalidades.

## 2) Estado final validado
- **Tag estable:** `v0.1.69-adein-crm-prospect-staging-managed-same-origin-activation`
- **HEAD/tag v074:** `d650d37`
- **Staging público:** `http://38.242.222.25:3016`
- **Producción:** `http://38.242.222.25:3006`
- **PM2 saved:** exitoso en `/root/.pm2/dump.pm2`

### Procesos activos (persistidos)
- `adein-crm-prospect-readonly-api-v069` — online
- `adein-panel-staging-same-origin-v074` — online
- `adein-panel-v040` — producción online

### Puertos finales
- `3006` en `0.0.0.0` para producción
- `3016` en `0.0.0.0` para staging público
- `3091` solo en `127.0.0.1` (no público)

### Endpoints relevantes
- Front staging: `http://38.242.222.25:3016`
- Front producción: `http://38.242.222.25:3006`
- Snapshot API same-origin (local):
  `http://127.0.0.1:3016/api/crm/prospect-staging/readonly-snapshot`

## 3) Evidencia read-only
Respuesta validada del endpoint same-origin:

```json
{
  "ok": true,
  "readonly": true,
  "writeExecuted": false,
  "commitExecuted": false,
  "transactionStarted": false,
  "productionTouched": false,
  "summaryCards": {
    "totalProspects": 1,
    "totalConversations": 1,
    "totalAnalyses": 1,
    "totalFollowups": 1,
    "totalHistoryEvents": 1,
    "syntheticRowsDetected": 3
  }
}
```

Validación pública registrada:
- `public_get_http_code=200` en staging público `3016`
- Assets públicos servidos:
  - `index-BVI4bCHv.js`
  - `index-Cw_ItOGC.css`

## 4) Evidencia de seguridad
- `3091` solo local (`127.0.0.1`), sin exposición pública.
- Verificación pública: `public_3091_http_code=000`.
- El navegador consume `3016` en same-origin.
- `3016` se comunica server-side con `3091` local.
- El navegador no toca MariaDB ni ve `3091`.
- Flags de inmutabilidad/seguridad confirmadas:
  - `writeExecuted=false`
  - `commitExecuted=false`
  - `transactionStarted=false`
  - `productionTouched=false`

## 5) Evidencia visual
En `http://38.242.222.25:3016`, la sección **“Prospectos staging / lectura controlada”** mostró:
- “Estado de consumo: Snapshot API disponible”
- Prospectos: `1`
- Conversaciones: `1`
- Análisis: `1`
- Followups: `1`
- Eventos: `1`
- Sintéticos detectados: `3`

## 6) Rollback
Ruta preparada de rollback:

`/root/adein-backups/adein_crm/v074/2026-05-26T19-23-03-pre-activation-same-origin/ROLLBACK_COMMANDS.sh`

Estado: **no ejecutado**, ya que la activación v074 fue exitosa y estable.

## 7) Estado de producción
Producción en `http://38.242.222.25:3006` se mantuvo viva e intacta durante la activación y validación de v074.

## 8) Estado de staging
Staging público en `http://38.242.222.25:3016` quedó vivo, accesible y operando bajo esquema same-origin con snapshot read-only.

## 9) Próximos pasos recomendados
- **v076:** limpiar UX del dashboard para dueño/vendedor con lenguaje cero técnico.
- **v077:** importador/rehearsal de `.txt` simulados de WhatsApp.
- **v078:** persistencia staging de prospectos desde `.txt` simulados y visualización en dashboard.
- **v079:** integrar vista read-only de datos inmobiliarios/clientes/pagos para demo.
- **v080:** beta staging por IP/puerto, aún sin dominio.
- **Después:** campaña real, captura de datos reales y limpieza progresiva de componentes fake/demo.

## 10) Límites de esta fase v075 (documental)
Esta fase **no** realiza cambios de runtime ni operación:
- No cambia runtime.
- No cambia PM2.
- No reinicia procesos.
- No cambia BD ni ejecuta escrituras.
- No cambia frontend.
- No toca producción.
- No modifica `src/`, scripts runtime ni integraciones reales (OpenAI/Facebook/WhatsApp).

---

**Conclusión:** v075 consolida evidencia documental de una activación v074 estable, segura y controlada, habilitando la siguiente fase funcional sin riesgo operativo adicional.

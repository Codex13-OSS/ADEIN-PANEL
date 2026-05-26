# v074 — Managed same-origin activation (staging, controlado y reversible)

Objetivo: preparar activación **manual/controlada** del bridge same-origin en staging sin tocar producción, sin PM2 automático y con rollback explícito.

## Scripts
- `npm run crm:prospect-staging:managed-same-origin-activation`
- `npm run crm:prospect-staging:managed-same-origin-activation:self-check`

## Modos
1. **Default (dry-run/preflight)**
   - `ADEIN_V074_MODE` omitido o `activation_preflight_dry_run`.
   - No toca PM2, no crea procesos persistentes, no usa 3006/3016, no activa cambios reales.

2. **Rehearsal temporal seguro**
   - Gates:
     - `ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074=1`
     - `ADEIN_V074_MODE=rehearsal`
   - Usa puertos temporales por defecto: v069 `3191`, v071 `3126`.
   - Verifica salud, snapshot, bloqueo de POST y cleanup sin procesos colgando.

3. **Artifact de activación controlada (solo instrucciones)**
   - Gates:
     - `ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074=1`
     - `ADEIN_V074_MODE=controlled_real_activation`
     - `ADEIN_DB_TARGET=staging`
     - `ADEIN_REQUIRE_HUMAN_APPROVAL=I_UNDERSTAND_THIS_CHANGES_STAGING_PM2`
     - `ADEIN_CONFIRM_NO_PRODUCTION=1`
     - `ADEIN_CONFIRM_ROLLBACK_READY=1`
   - Este modo **no ejecuta PM2** desde Codex: solo imprime comandos manuales para servidor.

## Seguridad
- Sin conexión navegador -> MariaDB.
- Frontend debe usar: `VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot`.
- `3091` queda local (`127.0.0.1`) y no expuesto público.
- Rollback documentado al modelo anterior `serve -s ... -l 3016`.

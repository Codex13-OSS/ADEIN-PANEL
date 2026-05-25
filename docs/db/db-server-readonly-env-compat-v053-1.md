# v053.1 — Server Read-Only Env Compatibility Patch

## Bug detectado
En la fase v053, la ejecución read-only real en servidor falló por compatibilidad de variables de entorno:
- El script esperaba `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`.
- El archivo externo real (`/root/adein-secrets/adein-crm-db.env`) usa `ADEIN_DB_HOST/ADEIN_DB_PORT/ADEIN_DB_NAME/ADEIN_DB_USER/ADEIN_DB_PASSWORD`.

No hubo escritura en BD, no hubo `COMMIT`, no hubo migraciones y producción/staging siguieron vivos.

## Por qué existe v053.1
v053.1 corrige de forma mínima la compatibilidad de llaves de credenciales para mantener la ejecución read-only/evidence-only en servidor sin cambiar el alcance de seguridad.

## Compatibilidad de variables soportada
El script principal ahora acepta ambos esquemas:
1. `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`
2. `ADEIN_DB_HOST/ADEIN_DB_PORT/ADEIN_DB_NAME/ADEIN_DB_USER/ADEIN_DB_PASSWORD`

Regla de prioridad:
- Si existen llaves `DB_*`, se usa `DB_*`.
- Si no existen llaves `DB_*`, se usa `ADEIN_DB_*`.

Si faltan campos requeridos en ambos esquemas, el script aborta de forma segura con error claro:
`Missing required DB env vars. Expected either DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD or ADEIN_DB_HOST/ADEIN_DB_PORT/ADEIN_DB_NAME/ADEIN_DB_USER/ADEIN_DB_PASSWORD`

## Seguridad y manejo de secretos
- Las credenciales se mantienen **fuera del repo**.
- El script **no imprime valores sensibles**.
- El script **no imprime password**.
- El JSON de salida expone únicamente metadatos no sensibles:
  - `sourceOfCredentials`
  - `credentialKeyScheme`

## Garantías read-only (sin escritura)
Se mantiene exactamente el envelope de no-escritura:
- `writesEnabled=false`
- `commitAllowed=false`
- `commitExecuted=false`
- `persistentWriteExecuted=false`
- `readOnly=true`
- `evidenceOnly=true`

Solo permite `SELECT COUNT(*)` sobre tablas permitidas (`allowedTables`).

## Ejecución en Mac (default seguro)
```bash
npm run db:server-readonly:evidence
npm run db:server-readonly:evidence:self-check
```

Esperado: dry-run seguro, sin conexión DB.

## Ejecución en servidor (evidencia read-only real)
```bash
export ADEIN_V053_SERVER_READONLY_EVIDENCE=1
export ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env
npm run db:server-readonly:evidence
```

## Siguiente paso
Desplegar tag **v053.1** en staging y repetir evidencia real read-only en servidor (sin habilitar escrituras).

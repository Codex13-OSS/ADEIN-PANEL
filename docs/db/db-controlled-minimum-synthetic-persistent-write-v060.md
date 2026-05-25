# v060 - Controlled Minimum Synthetic Persistent Write (Staging)

## Objetivo
Implementar la primera escritura persistente mínima y controlada para CRM en staging, con datos **100% sintéticos**, bajo gates estrictos y abortos explícitos.

## Qué escribe exactamente (modo real controlado)
- 1 row: `properties`
- 1 row: `lots` (relacionada con `property`)
- 1 row: `clients`
- 1 row: `contracts` (relacionada con `client` + `lot/property`)
- 1 row: `payment_schedule` (relacionada con `contract`)

Total esperado: **5 rows**.

## Por qué datos sintéticos
Se requiere minimizar riesgo operativo y evitar uso de datos reales/personales. Todos los textos, email y teléfono son de prueba:
- `PROPIEDAD SINTETICA V060 - NO REAL`
- `LOTE SINTETICO V060 - NO REAL`
- `CLIENTE SINTETICO V060 - NO REAL`
- `CONTRATO SINTETICO V060 - NO REAL`
- `cliente.sintetico.v060@example.invalid`
- `0000000000`

## Gates requeridos (modo real)
- `ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENV_FILE=<ruta env staging>`
- `ADEIN_V060_WRITE_GATE=CONTROLLED_SYNTHETIC_PERSISTENT_WRITE_V060`
- `ADEIN_V060_APPROVAL_TOKEN=APPROVE_SYNTHETIC_STAGING_WRITE_V060`
- `ADEIN_V060_REQUIRE_EMPTY_ALLOWED_TABLES=1`
- `ADEIN_V060_BACKUP_EVIDENCE_FILE=<backup_evidence_v054.json>`
- `ADEIN_V060_EXPECTED_BACKUP_SHA256=<sha256 esperado del evidence file>`

## Comandos
### Default safe (sin conexión DB)
```bash
npm run db:controlled-minimum-synthetic-write:v060
```

### Self-check local
```bash
npm run db:controlled-minimum-synthetic-write:v060:self-check
```

### Modo real controlado (placeholder, sin credenciales)
```bash
ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE=1 \
ADEIN_DB_ENV_FILE=/secure/path/.env.staging \
ADEIN_V060_WRITE_GATE=CONTROLLED_SYNTHETIC_PERSISTENT_WRITE_V060 \
ADEIN_V060_APPROVAL_TOKEN=APPROVE_SYNTHETIC_STAGING_WRITE_V060 \
ADEIN_V060_REQUIRE_EMPTY_ALLOWED_TABLES=1 \
ADEIN_V060_BACKUP_EVIDENCE_FILE=/secure/path/backup_evidence_v054.json \
ADEIN_V060_EXPECTED_BACKUP_SHA256=<sha256> \
npm run db:controlled-minimum-synthetic-write:v060
```

## Abort conditions
- Falta cualquier gate requerida.
- No existe o no valida el backup evidence.
- SHA256 no coincide.
- Tablas permitidas no están vacías (cuando se exige empty).
- Ya existe token sintético de v060.
- Schema real exige columnas no resueltas para inserción mínima.
- Falla cualquier INSERT.
- Delta post-commit distinto a +1 en cada tabla permitida.

## Rollback plan
Este script **NO** borra datos automáticamente (sin `DELETE/UPDATE`).
Si se requiere reversión, usar restauración del backup validado (`v054`) bajo runbook operativo de DBA/staging.

## Validación esperada
- Default: `dryRun=true`, `databaseConnected=false`, `insertsExecuted=0`, `commitExecuted=false`.
- Real controlado: `insertsExecuted=5`, `commitExecuted=true`, `rowCountsVerified=true`, delta exacto +1 por tabla permitida.

## Siguiente fase sugerida
Conectar dashboard/read-only a estos datos sintéticos persistidos (sin nuevos writes).

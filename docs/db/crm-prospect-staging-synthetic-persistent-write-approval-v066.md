# v066 — CRM Prospect Staging Synthetic Persistent Write Approval (Evidence Only)

## Qué hace v066
- Prepara un artefacto JSON de aprobación/evidencia para una futura ejecución de write persistente sintético en staging.
- Por defecto corre en `approval_evidence_only` (dry-run) y **no conecta a BD**.
- Genera payload sintético demo en memoria y plan propuesto de escritura para estas 6 tablas:
  - `lead_sources`
  - `prospects`
  - `whatsapp_conversations`
  - `whatsapp_analyses`
  - `prospect_followups`
  - `crm_history_events`

## Qué NO hace v066
- No inicia transacción.
- No ejecuta `COMMIT`.
- No ejecuta escritura persistente real.
- No usa datos reales ni prospectos reales de campaña.
- No toca producción.
- No usa OpenAI/IA real, Facebook API real, ni WhatsApp API real.
- No escribe ni enruta leads a `clients`, `contracts`, `payment_schedule`, `lots`.

## Por qué todavía no ejecuta commit real
v066 es una fase de **approval/precommit evidence only**. Su objetivo es dejar gates, contrato de evidencia y condiciones de abort listas para una futura fase (v067+) con protocolo de commit explícito.

## Comandos
### 1) Approval evidence dry-run (default)
```bash
npm run crm:prospect-staging:persistent-write-approval
```
Resultado esperado:
- `mode: "approval_evidence_only"`
- `dryRun: true`
- `databaseConnectionAttempted: false`
- `transactionStarted: false`
- `commitExecuted: false`
- `persistentWriteExecuted: false`

### 2) Self-check local (sin BD real)
```bash
npm run crm:prospect-staging:persistent-write-approval:self-check
```
Valida contrato JSON, defaults seguros, rechazo de señales peligrosas, rechazo de intento de commit real, y ausencia de patrón COMMIT ejecutable.

### 3) Controlled read-only evidence en staging (opcional, autorizado)
Gates requeridos:
- `ADEIN_CRM_PROSPECT_STAGING_PERSISTENT_WRITE_APPROVAL_V066=1`
- `ADEIN_DB_ENV_FILE=<ruta>`
- `ADEIN_DB_TARGET=staging`
- `ADEIN_DB_READONLY_EVIDENCE=1`

Flujo:
1. Conecta solo para evidencia read-only (`SELECT/COUNT`).
2. Verifica existencia de las 6 tablas objetivo.
3. Lee row counts actuales.
4. Confirma que `clients/contracts/payment_schedule/lots` no son destinos.
5. Reporta warnings si ya existen datos previos en staging (no bloqueante).

## Abort conditions
- `NODE_ENV=production`
- `ADEIN_DB_TARGET=production`
- `ADEIN_DB_ENV=production`
- `ADEIN_DB_COMMIT=1`
- `ADEIN_DB_ALLOW_PERSISTENT_WRITE=1`
- `ADEIN_DB_ENABLE_WRITES=1`
- `ADEIN_DB_WRITE_GATE=REAL_COMMIT`
- `ADEIN_DB_WRITE_GATE=PERSISTENT_WRITE`
- `ADEIN_DB_WRITE_GATE=COMMIT_V066`
- `ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT`

Respuesta esperada al detectar intento de commit real en v066:
- `ok: false`
- `phase: "v066"`
- `aborted: true`
- `reason: "persistent write is not enabled in v066"`

## Gates futuros esperados para v067
- Protocolo formal de commit persistente documentado y aprobado.
- Token/gate dedicado de commit (nuevo, no reutilizar v066).
- Checklist pre-commit completo (tabla/row-count/salud de servicios/ventana operativa).
- Plan de rollback compensatorio validado por token sintético.

## Evidencia esperada en futura persistencia sintética
- Incremento consistente de row counts en las 6 tablas por token sintético.
- Integridad referencial validada entre las entidades insertadas.
- Artefacto de auditoría con IDs insertados y verificación post-escritura.

## Rollback plan conceptual para futura persistencia
Ante fallo parcial post-commit futuro, ejecutar eliminación compensatoria por token sintético en orden:
1. `crm_history_events`
2. `prospect_followups`
3. `whatsapp_analyses`
4. `whatsapp_conversations`
5. `prospects`
6. `lead_sources`

Siempre restringido a staging, con evidencia previa y sin tocar producción.

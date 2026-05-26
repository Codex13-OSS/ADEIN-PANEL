#!/usr/bin/env node

const PHASE = 'v069';
const MODE_DRY = 'dry_run';

const allowedRoutes = [
  'GET /health',
  'GET /api/crm/prospect-staging/readonly-snapshot',
  'GET /api/crm/prospect-staging/readonly-evidence'
];

const forbiddenRoutes = ['POST', 'PUT', 'PATCH', 'DELETE', '/write', '/commit', '/rollback', '/admin/delete', '/production'];

const payload = {
  ok: true,
  phase: PHASE,
  mode: MODE_DRY,
  dryRun: true,
  databaseConnectionAttempted: false,
  serverStarted: false,
  writeExecuted: false,
  commitExecuted: false,
  readonly: true,
  productionTouched: false,
  bridgePlan: {
    purpose: 'Preparar bridge read-only entre dashboard y snapshot controlado server-side sin navegador->MariaDB.',
    executionModel: 'dry-run por defecto; server gated opcional en localhost',
    dbAccessPolicy: 'Sin conexión BD por defecto; controlled solo con gates explícitos staging/read-only',
    writePolicy: 'Bloqueo total de escritura y commit'
  },
  allowedRoutes,
  forbiddenRoutes,
  snapshotContract: {
    endpoint: 'GET /api/crm/prospect-staging/readonly-snapshot',
    requiredKeys: ['ok', 'phase', 'mode', 'readonly', 'writeExecuted', 'commitExecuted', 'dashboardPayload|dashboardPayloadPreview'],
    readonlyIndicators: ['readonly=true', 'writeExecuted=false', 'commitExecuted=false']
  },
  safetyEnvelope: {
    defaultMode: MODE_DRY,
    blockedSignals: ['NODE_ENV=production', 'ADEIN_DB_TARGET=production'],
    requiredControlledGates: [
      'ADEIN_CRM_PROSPECT_STAGING_READONLY_API_V069=1',
      'ADEIN_DB_ENV_FILE=<path>',
      'ADEIN_DB_TARGET=staging',
      'ADEIN_DB_READONLY_API=1',
      'ADEIN_API_BIND_HOST=127.0.0.1',
      'ADEIN_API_PORT=3091'
    ],
    forbiddenWriteKeywords: ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'TRUNCATE', 'CREATE', 'REPLACE']
  }
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

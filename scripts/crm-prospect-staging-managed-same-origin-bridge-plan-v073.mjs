#!/usr/bin/env node

const PHASE = 'v073';

const payload = {
  ok: true,
  phase: PHASE,
  mode: 'managed_same_origin_bridge_plan',
  dryRun: true,
  productionTouched: false,
  stagingPm2Touched: false,
  writeExecuted: false,
  commitExecuted: false,
  transactionStarted: false,
  gates: {
    defaultBehavior: 'planning_only',
    requiresExplicitManualActivation: true,
    requiresManualConfirmationBeforePm2Change: true,
    allowsPersistentProcessesByDefault: false
  },
  currentStagingModel: {
    pm2App: 'adein-panel-staging-v052',
    currentPublicPort: 3016,
    currentMode: 'static serve / fallback local',
    expectedServeCommand: 'serve -s /opt/ADEIN-PANEL-staging-v052/dist -l 3016'
  },
  targetStagingModel: {
    managedSameOriginBridgeOnPort: 3016,
    readonlyApiLocal: 'http://127.0.0.1:3091',
    sameOriginServer: 'v071 serves dist + /api/crm/prospect-staging/readonly-* on 3016',
    frontendSnapshotEnv: 'VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot',
    browserAccessPolicy: 'browser only hits 3016; no direct 3091 exposure'
  },
  requiredManualSteps: [
    'backup current PM2 command/config',
    'build with VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot',
    'start v069 API local read-only controlled at 127.0.0.1:3091 with exact staging/read-only gates',
    'replace staging PM2 command with v071 same-origin server only after explicit human confirmation',
    'validate /health in staging 3016',
    'validate /api/crm/prospect-staging/readonly-snapshot via same-origin 3016 route',
    'validate dashboard UX change from "Fallback local activo" to "Snapshot API disponible"',
    'keep rollback command ready to restore previous serve -s dist -l 3016 model'
  ],
  abortConditions: [
    '3006 affected',
    '3016 unhealthy',
    '3091 exposed publicly',
    'any write/commit/transaction flag true',
    'productionTouched true',
    'PM2 app not known',
    'env file missing',
    'build fails',
    'snapshot invalid',
    'lingering processes'
  ],
  rollbackPlan: [
    'stop v071 managed staging process',
    'restore PM2 command serve -s /opt/ADEIN-PANEL-staging-v052/dist -l 3016',
    'stop v069 local API process',
    'verify 3006 and 3016 HTTP 200',
    'verify no 3091 public exposure'
  ],
  validationPlan: [
    'local curl 127.0.0.1:3006',
    'local curl 127.0.0.1:3016',
    'public curl 38.242.222.25:3016',
    'local curl 127.0.0.1:3091/health',
    'same-origin curl 127.0.0.1:3016/api/crm/prospect-staging/readonly-snapshot',
    'UI visual validation'
  ]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

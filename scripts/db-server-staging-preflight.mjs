#!/usr/bin/env node

const phase = 'v052';

const dangerRules = [
  { key: 'ADEIN_DB_COMMIT', value: '1', reason: 'Blocked: ADEIN_DB_COMMIT=1 requests a real commit.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', value: '1', reason: 'Blocked: ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 requests persistent writes.' },
  { key: 'ADEIN_DB_ENABLE_WRITES', value: '1', reason: 'Blocked: ADEIN_DB_ENABLE_WRITES=1 enables writes.' },
  { key: 'ADEIN_DB_MODE', value: 'write', reason: 'Blocked: ADEIN_DB_MODE=write is not allowed in v052.' },
  { key: 'ADEIN_DB_MODE', value: 'read_write', reason: 'Blocked: ADEIN_DB_MODE=read_write is not allowed in v052.' },
  { key: 'ADEIN_DB_WRITE_GATE', value: 'REAL_COMMIT', reason: 'Blocked: ADEIN_DB_WRITE_GATE=REAL_COMMIT is not allowed in v052.' },
  { key: 'ADEIN_DB_WRITE_GATE', value: 'V052_REAL_COMMIT', reason: 'Blocked: ADEIN_DB_WRITE_GATE=V052_REAL_COMMIT is not allowed in v052.' },
  { key: 'ADEIN_DB_APPROVAL_TOKEN', value: 'APPROVE_REAL_COMMIT', reason: 'Blocked: ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT is not allowed in v052.' },
  { key: 'ADEIN_DB_PERSISTENT_WRITE', value: '1', reason: 'Blocked: ADEIN_DB_PERSISTENT_WRITE=1 requests persistent write execution.' },
  { key: 'ADEIN_DB_ROW_COUNTS_CONFIRMED', value: '1', reason: 'Blocked: ADEIN_DB_ROW_COUNTS_CONFIRMED=1 indicates write-phase gating.' },
  { key: 'ADEIN_TOUCH_PRODUCTION_PORT', value: '1', reason: 'Blocked: ADEIN_TOUCH_PRODUCTION_PORT=1 is forbidden in v052.' },
  { key: 'ADEIN_PM2_MODIFY_PRODUCTION', value: '1', reason: 'Blocked: ADEIN_PM2_MODIFY_PRODUCTION=1 is forbidden in v052.' }
];

const blockedBy = dangerRules.find(({ key, value }) => process.env[key] === value);

if (blockedBy) {
  const payload = {
    ok: false,
    phase,
    blocked: true,
    reason: blockedBy.reason,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    productionPortTouched: false,
    pm2Modified: false
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

const payload = {
  ok: true,
  phase,
  mode: 'server_staging_preflight',
  dryRun: true,
  preflightOnly: true,
  readOnly: true,
  databaseConnectionRequired: false,
  databaseConnected: false,
  writesEnabled: false,
  commitAllowed: false,
  commitExecuted: false,
  persistentWriteExecuted: false,
  realDataUsed: false,
  credentialsRequired: false,
  pm2Modified: false,
  productionPortTouched: false,
  stagingPortSuggested: true,
  baseCheckpoint: {
    tag: 'v0.1.41-adein-crm-controlled-persistent-write-approval-evidence-pack',
    head: 'fb09171',
    phase: 'v051',
    status: 'stable'
  },
  serverTargets: {
    server: '38.242.222.25',
    repoPath: '/opt/ADEIN-PANEL',
    productionPort: 3006,
    productionPm2Name: 'adein-panel-v040',
    stagingPortCandidates: [3016, 3017, 3018],
    recommendedStagingPort: 3016,
    stagingPm2Name: 'adein-panel-staging-v052'
  },
  requiredServerPreflight: {
    serverReachable: false,
    repoPathConfirmed: false,
    tagFetchedOnServer: false,
    cleanServerWorktree: false,
    stagingPortAvailable: false,
    productionServiceUnaffected: false,
    pm2StagingNameAvailable: false,
    backupCreated: false,
    databaseSnapshotCreated: false,
    beforeRowCountsCaptured: false,
    evidenceOutputPathConfirmed: false,
    rollbackCommandPrepared: false,
    humanApprovalConfirmed: false
  },
  allowedTables: ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'],
  forbiddenTables: [
    'crm_users',
    'sellers',
    'crm_followups',
    'import_batches',
    'import_raw_rows',
    'migration_plans',
    'migration_plan_events',
    'audit_log',
    'any table not listed in allowedTables'
  ],
  rowCountPlan: {
    beforeCountsRequired: true,
    afterCountsRequired: true,
    expectedDeltaRequired: true,
    mismatchAbort: true,
    allowedTablesOnly: true,
    outputFormat: 'json',
    queriesExecutedInV052: false
  },
  backupSnapshotPlan: {
    backupRequiredBeforeWrite: true,
    snapshotRequiredBeforeWrite: true,
    backupPathSuggested: '/root/adein-backups',
    evidencePathSuggested: '/tmp/adein-v052-server-staging-preflight.json',
    credentialsPathExpected: '/root/adein-secrets/adein-crm-db.env',
    credentialsStoredInRepo: false
  },
  stagingDeploymentPlan: [
    'git fetch origin --tags --prune',
    'git checkout/switch stable tag or branch',
    'npm ci',
    'npm run build',
    'start staging PM2 with a separate port',
    'validate local curl to staging port',
    'confirm production port 3006 remains intact'
  ],
  rollbackPlan: {
    codeRollbackToPreviousStableTag: true,
    previousStableTag: 'v0.1.41-adein-crm-controlled-persistent-write-approval-evidence-pack',
    pm2RestartRequired: true,
    dataRollbackRequiresBackup: true,
    gitDoesNotRollbackDatabaseWrites: true
  },
  abortConditions: [
    'production port 3006 would be touched',
    'PM2 production service would be modified',
    'missing backup/snapshot',
    'missing row counts',
    'dirty server worktree',
    'staging port unavailable',
    'unexpected table access',
    'write/read_write mode requested',
    'commit gate present',
    'credentials attempted in repo',
    'real-data payload detected',
    'any persistent write attempt'
  ],
  safetyEnvelope: [
    'staging preflight only',
    'production untouched',
    'commit hard-disabled in v052',
    'persistent writes hard-disabled in v052',
    'DB connection disabled by default',
    'credentials forbidden in repo',
    'real data forbidden',
    'future write must be separate explicit phase'
  ]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

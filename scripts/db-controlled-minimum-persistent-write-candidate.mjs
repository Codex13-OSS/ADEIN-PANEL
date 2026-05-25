#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';

const phase = 'v056';
const mode = 'controlled_minimum_persistent_write_candidate';

const baseTag = 'v0.1.46-adein-crm-prewrite-approval-gate';
const expectedHead = '5e09e5b';
const requiredBackupPath = '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql';
const requiredBackupSha256 = '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d';
const requiredApprovalToken = 'APPROVE_V056_MINIMUM_SYNTHETIC_PERSISTENT_WRITE';

const allowedTables = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
const forbiddenTables = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log',
  'any table not listed in allowedTables'
];

const dangerousEnvChecks = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V056_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', requiredApprovalToken]
];

function fail(payload, error) {
  payload.ok = false;
  payload.error = error;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

async function run() {
  const controlledReadonlyMode = process.env.ADEIN_V056_CONTROLLED_READONLY === '1';
  const tokenProvided = process.env.ADEIN_DB_APPROVAL_TOKEN === requiredApprovalToken;

  const payload = {
    ok: true,
    phase,
    mode,
    dryRun: true,
    candidateOnly: true,
    writesEnabled: false,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    databaseConnectionAttempted: false,
    noWriteSqlExecuted: true,
    noSchemaChanges: true,
    noDataMigration: true,
    syntheticDataOnly: true,
    realDataUsed: false,
    baseCheckpoint: {
      tag: baseTag,
      expectedHead
    },
    requiredBackup: {
      path: requiredBackupPath,
      expectedSha256: requiredBackupSha256,
      exists: false,
      actualSha256: null,
      sha256Matches: false
    },
    requiredCurrentRowCountsBeforeWrite: {
      clients: 0,
      properties: 0,
      lots: 0,
      contracts: 0,
      payment_schedule: 0
    },
    syntheticCandidateRows: {
      properties: '1 synthetic row',
      lots: '1 synthetic row related to property',
      clients: '1 synthetic row',
      contracts: '1 synthetic row related to client/lot/property',
      payment_schedule: 'minimum 1 synthetic row related to contract'
    },
    relationshipPlan: [
      'properties -> lots',
      'clients -> contracts',
      'properties/lots -> contracts',
      'contracts -> payment_schedule'
    ],
    executionPlan: [
      'step 1: verify base checkpoint',
      'step 2: verify backup artifact + sha256',
      'step 3: verify row counts actuales',
      'step 4: prepare transaction',
      'step 5: insert synthetic rows in relational order',
      'step 6: verify inserted rows inside transaction',
      'step 7: rollback by default',
      'step 8: future explicit approval required before persistent COMMIT'
    ],
    approvalGate: {
      humanApprovalRequired: true,
      requiredToken: requiredApprovalToken,
      tokenProvided,
      commitStillBlocked: true
    },
    abortConditions: [
      'backup missing',
      'backup sha mismatch',
      'row counts are not all zero',
      'env file missing when controlled DB mode is requested',
      'production port touch attempted',
      'real data detected',
      'commit env vars detected without correct future phase',
      'schema mismatch',
      'any table outside allowed list requested'
    ],
    allowedTables,
    forbiddenTables,
    controlledReadonlyMode,
    controlledReadonlyChecks: {
      attempted: false,
      envFileProvided: false,
      dbReadConnectionAttempted: false,
      rowCountsVerified: false
    },
    generatedAt: new Date().toISOString()
  };

  for (const [k, v] of dangerousEnvChecks) {
    if (process.env[k] === v) {
      fail(payload, `Dangerous write-related env detected: ${k}=${v}`);
    }
  }

  if (!controlledReadonlyMode) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  payload.controlledReadonlyChecks.attempted = true;
  const envFilePath = process.env.ADEIN_DB_ENV_FILE || '';
  payload.controlledReadonlyChecks.envFileProvided = Boolean(envFilePath);

  if (!envFilePath || !fs.existsSync(envFilePath)) {
    fail(payload, 'Controlled read-only mode requires ADEIN_DB_ENV_FILE and file must exist');
  }

  payload.databaseConnectionAttempted = true;
  payload.controlledReadonlyChecks.dbReadConnectionAttempted = true;
  payload.requiredBackup.exists = fs.existsSync(requiredBackupPath);
  if (!payload.requiredBackup.exists) fail(payload, 'Abort condition: backup missing');

  const backupBuffer = fs.readFileSync(requiredBackupPath);
  payload.requiredBackup.actualSha256 = crypto.createHash('sha256').update(backupBuffer).digest('hex');
  payload.requiredBackup.sha256Matches = payload.requiredBackup.actualSha256 === requiredBackupSha256;
  if (!payload.requiredBackup.sha256Matches) fail(payload, 'Abort condition: backup sha mismatch');

  payload.controlledReadonlyChecks.rowCountsVerified = false;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

run().catch((error) => {
  const fallback = {
    ok: false,
    phase,
    mode,
    error: error.message,
    generatedAt: new Date().toISOString()
  };
  process.stdout.write(`${JSON.stringify(fallback, null, 2)}\n`);
  process.exit(1);
});

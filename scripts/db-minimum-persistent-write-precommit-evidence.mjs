import fs from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';

const PHASE = 'v059';
const MODE = 'minimum_persistent_write_precommit_evidence';
const ALLOWED_TABLES = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
const FORBIDDEN_TABLES = [
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
const BACKUP_PATH = '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql';
const BACKUP_SHA256 = '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d';

const DANGEROUS_ENV_RULES = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_WRITES_ENABLED', 'true'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_MODE', 'persistent_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V059_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT'],
  ['ADEIN_V059_EXECUTE_COMMIT', '1'],
  ['ADEIN_V059_ALLOW_INSERT', '1'],
  ['ADEIN_V059_OPEN_TRANSACTION', '1']
];

function printAndExit(payload, code = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

function sha256File(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

async function maybeLoadControlledReadonlyEnv(enabled) {
  if (!enabled) return;
  const envFile = process.env.ADEIN_DB_ENV_FILE;
  if (!envFile) throw new Error('ADEIN_DB_ENV_FILE is required when ADEIN_V059_CONTROLLED_READONLY=1');
  const envText = fs.readFileSync(envFile, 'utf-8');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function run() {
  const triggeredDangerousEnv = DANGEROUS_ENV_RULES.filter(([k, v]) => process.env[k] === v).map(([k]) => k);
  if (triggeredDangerousEnv.length > 0) {
    printAndExit(
      {
        ok: false,
        phase: PHASE,
        mode: MODE,
        errorCode: 'DANGEROUS_ENV_BLOCKED',
        message: 'Detected blocked write/commit environment flags.',
        blockedVariables: triggeredDangerousEnv,
        commitAllowed: false,
        commitExecuted: false,
        persistentWriteExecuted: false
      },
      1
    );
  }

  const controlledReadonlyMode = process.env.ADEIN_V059_CONTROLLED_READONLY === '1';
  const payload = {
    ok: true,
    phase: PHASE,
    mode: MODE,
    dryRun: true,
    evidenceOnly: true,
    preCommitOnly: true,
    humanAuthorizationGate: true,
    databaseConnectionAttempted: false,
    controlledReadonlyMode,
    transactionOpened: false,
    writeSqlExecuted: false,
    insertExecuted: false,
    commitAllowed: false,
    commitAttempted: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    noPersistentWrite: true,
    noSchemaChanges: true,
    noDataMigration: true,
    syntheticDataOnly: true,
    realDataUsed: false,
    commitStillDisabled: true,
    allowedTables: ALLOWED_TABLES,
    forbiddenTables: FORBIDDEN_TABLES,
    abortConditions: DANGEROUS_ENV_RULES.map(([k, v]) => `${k}=${v}`),
    blockedDangerousVariables: DANGEROUS_ENV_RULES.map(([k]) => k),
    requiredEvidence: {
      v054Backup: { path: BACKUP_PATH, sha256: BACKUP_SHA256 },
      v0561ControlledReadonlyRowCountsFix: {
        tag: 'v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix',
        head: 'a3dce91',
        requiredRowCountsZero: ALLOWED_TABLES
      },
      v057ControlledTransactionRollbackRehearsal: {
        tag: 'v0.1.48-adein-crm-controlled-transaction-rollback-rehearsal',
        head: '3eceb82',
        rollbackOnlySuccessfulRequired: true,
        postRollbackVerifiedRequired: true
      },
      v058MinimumPersistentWriteApprovalArtifact: {
        tag: 'v0.1.49-adein-crm-minimum-persistent-write-approval-artifact',
        head: '2cc088e',
        artifactOnlyRequired: true,
        commitDisabledRequired: true
      }
    },
    proposedFutureMinimumPersistentWrite: {
      futurePhaseOnly: true,
      syntheticPlan: {
        properties: 1,
        lots: 1,
        clients: 1,
        contracts: 1,
        payment_schedule: 1
      },
      relationRequirements: [
        'lot must be linked to property',
        'contract must be linked to client, property, and lot',
        'payment_schedule row must be linked to contract'
      ],
      mustNeverUseRealClientData: true,
      requiresSeparateHumanAuthorization: true,
      requiresFreshBackupVerification: true,
      requiresFreshRowCountsVerification: true,
      requiresFreshRollbackRehearsalOrExplicitRelianceOnV057: true,
      requiresStagingOnlyFirst: true,
      requiresPostCommitVerificationPlanInFuturePhase: true
    },
    preCommitChecklist: [
      'repo clean',
      'base tag verified',
      'staging service alive',
      'production service alive but untouched',
      'backup artifact exists + sha matches',
      'current row counts are 0',
      'rollback evidence exists',
      'human approval exists',
      'commit remains disabled in v059',
      'future commit phase not implemented in v059'
    ]
  };

  if (controlledReadonlyMode) {
    await maybeLoadControlledReadonlyEnv(true);
    if (!fs.existsSync(BACKUP_PATH)) throw new Error('Required backup artifact does not exist');
    if (sha256File(BACKUP_PATH) !== BACKUP_SHA256) throw new Error('Backup SHA256 mismatch');

    const requiredDbEnv = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD', 'ADEIN_DB_NAME'];
    const missing = requiredDbEnv.filter((key) => !process.env[key]);
    if (missing.length > 0) throw new Error(`Missing required ADEIN_DB_* variables: ${missing.join(',')}`);

    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.ADEIN_DB_HOST,
      port: Number(process.env.ADEIN_DB_PORT),
      user: process.env.ADEIN_DB_USER,
      password: process.env.ADEIN_DB_PASSWORD,
      database: process.env.ADEIN_DB_NAME
    });

    const rowCounts = {};
    try {
      payload.databaseConnectionAttempted = true;
      for (const table of ALLOWED_TABLES) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
        rowCounts[table] = Number(rows?.[0]?.count ?? NaN);
      }
    } finally {
      await connection.end();
    }

    const nonZeroTables = Object.entries(rowCounts).filter(([, count]) => count !== 0).map(([table]) => table);
    if (nonZeroTables.length > 0) {
      throw new Error(`Controlled readonly verification failed: non-zero row counts detected (${nonZeroTables.join(',')})`);
    }

    payload.backupVerified = true;
    payload.rowCountsVerified = true;
    payload.rowCounts = rowCounts;
  }

  printAndExit(payload, 0);
}

run().catch((error) => {
  printAndExit(
    {
      ok: false,
      phase: PHASE,
      mode: MODE,
      errorCode: 'PRECOMMIT_EVIDENCE_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      commitAllowed: false,
      commitExecuted: false,
      persistentWriteExecuted: false
    },
    1
  );
});

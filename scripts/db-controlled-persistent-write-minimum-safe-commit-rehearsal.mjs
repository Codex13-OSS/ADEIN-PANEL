#!/usr/bin/env node

const phase = 'v050';
const mode = 'minimum_safe_commit_rehearsal';

const dangerousSignals = [
  {
    key: 'ADEIN_DB_COMMIT',
    expected: '1',
    reason: 'ADEIN_DB_COMMIT=1 is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE',
    expected: '1',
    reason: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_ENABLE_WRITES',
    expected: '1',
    reason: 'ADEIN_DB_ENABLE_WRITES=1 is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_MODE',
    expected: 'write',
    reason: 'ADEIN_DB_MODE=write is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_MODE',
    expected: 'read_write',
    reason: 'ADEIN_DB_MODE=read_write is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_WRITE_GATE',
    expected: 'REAL_COMMIT',
    reason: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_WRITE_GATE',
    expected: 'V050_REAL_COMMIT',
    reason: 'ADEIN_DB_WRITE_GATE=V050_REAL_COMMIT is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_APPROVAL_TOKEN',
    expected: 'APPROVE_REAL_COMMIT',
    reason: 'ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT is forbidden in v050 rehearsal mode.'
  },
  {
    key: 'ADEIN_DB_PERSISTENT_WRITE',
    expected: '1',
    reason: 'ADEIN_DB_PERSISTENT_WRITE=1 is forbidden in v050 rehearsal mode.'
  }
];

const blockedSignal = dangerousSignals.find(({ key, expected }) => process.env[key] === expected);

if (blockedSignal) {
  const blockedOutput = {
    ok: false,
    phase,
    mode,
    blocked: true,
    reason: blockedSignal.reason,
    commitExecuted: false,
    persistentWriteExecuted: false
  };

  process.stdout.write(`${JSON.stringify(blockedOutput, null, 2)}\n`);
  process.exit(1);
}

const output = {
  ok: true,
  phase,
  mode,
  dryRun: true,
  rehearsalOnly: true,
  readOnly: true,
  databaseConnectionRequired: false,
  databaseConnected: false,
  writesEnabled: false,
  commitAllowed: false,
  commitExecuted: false,
  persistentWriteExecuted: false,
  realDataUsed: false,
  credentialsRequired: false,
  baseEvidence: {
    rollbackEvidence: [
      'v042 real rollback-only approved',
      'v048 controlled real write rehearsal'
    ],
    planningEvidence: [
      'v049 controlled persistent write candidate'
    ]
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
  proposedInsertOrder: ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'],
  expectedRowCounts: {
    clients: 1,
    properties: 1,
    lots: 1,
    contracts: 1,
    payment_schedule: 'at least 1',
    note: 'v050 rehearsal only: no rows are inserted in this phase.'
  },
  requiredPreconditions: [
    'repository clean before any future operation',
    'stable v049 tag is confirmed',
    'backup/snapshot created before any future write attempt',
    'rollback-only evidence from v042 and v048 is available',
    'approval artifact is generated and reviewed',
    'explicit human authorization from the user is present',
    'before/after row-count procedure is predefined',
    'abort plan is documented',
    'strict allowed-tables validation is enforced'
  ],
  abortConditions: [
    'missing backup/snapshot',
    'missing explicit human approval',
    'unexpected row counts',
    'unexpected table access request',
    'dangerous environment variable detected',
    'mode write/read_write requested',
    'missing or ambiguous credentials',
    'any unauthorized commit attempt'
  ],
  futureCommitGates: [
    'ADEIN_DB_ALLOW_PERSISTENT_WRITE',
    'ADEIN_DB_WRITE_GATE',
    'ADEIN_DB_APPROVAL_TOKEN',
    'ADEIN_DB_COMMIT',
    'ADEIN_DB_BACKUP_CONFIRMED',
    'ADEIN_DB_SNAPSHOT_CONFIRMED'
  ],
  safetyEnvelope: {
    commit: 'hard-disabled in v050',
    persistentWrites: 'hard-disabled in v050',
    realData: 'forbidden',
    credentials: 'not required',
    dbConnection: 'not required by default',
    futureCommit: 'must happen in a separate explicit phase'
  },
  approvalArtifactCandidate: {
    approved: false,
    validForRealCommit: false,
    generatedByPhase: 'v050',
    requiresHumanApproval: true
  }
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

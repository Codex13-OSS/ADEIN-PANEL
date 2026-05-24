const phase = 'v051';

const DANGEROUS_SIGNALS = [
  { key: 'ADEIN_DB_COMMIT', value: '1', reason: 'ADEIN_DB_COMMIT=1 is not allowed in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', value: '1', reason: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 is not allowed in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_ENABLE_WRITES', value: '1', reason: 'ADEIN_DB_ENABLE_WRITES=1 is not allowed in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_MODE', value: 'write', reason: 'ADEIN_DB_MODE=write is blocked in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_MODE', value: 'read_write', reason: 'ADEIN_DB_MODE=read_write is blocked in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_WRITE_GATE', value: 'REAL_COMMIT', reason: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT is blocked in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_WRITE_GATE', value: 'V051_REAL_COMMIT', reason: 'ADEIN_DB_WRITE_GATE=V051_REAL_COMMIT is blocked in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_APPROVAL_TOKEN', value: 'APPROVE_REAL_COMMIT', reason: 'ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT is blocked in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_PERSISTENT_WRITE', value: '1', reason: 'ADEIN_DB_PERSISTENT_WRITE=1 is not allowed in v051 evidence-only mode.' },
  { key: 'ADEIN_DB_ROW_COUNTS_CONFIRMED', value: '1', reason: 'ADEIN_DB_ROW_COUNTS_CONFIRMED=1 is blocked in v051 evidence-only mode.' }
];

const matchedSignal = DANGEROUS_SIGNALS.find(({ key, value }) => process.env[key] === value);

if (matchedSignal) {
  const blockedPayload = {
    ok: false,
    phase,
    blocked: true,
    reason: matchedSignal.reason,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    validForRealCommit: false
  };

  process.stdout.write(`${JSON.stringify(blockedPayload, null, 2)}\n`);
  process.exit(1);
}

const payload = {
  ok: true,
  phase,
  mode: 'approval_evidence_pack',
  dryRun: true,
  evidenceOnly: true,
  readOnly: true,
  databaseConnectionRequired: false,
  databaseConnected: false,
  writesEnabled: false,
  commitAllowed: false,
  commitExecuted: false,
  persistentWriteExecuted: false,
  realDataUsed: false,
  credentialsRequired: false,
  validForRealCommit: false,
  baseCheckpoints: [
    'v042 rollback fixture required columns / rollback-only real approved',
    'v043 real rollback evidence',
    'v044 controlled write approval protocol',
    'v045 controlled write dry-run',
    'v046 controlled write preflight',
    'v047 readonly verification',
    'v048 controlled real write rehearsal',
    'v049 persistent write candidate',
    'v050 minimum safe commit rehearsal'
  ],
  requiredEvidencePack: {
    repoClean: false,
    stableTagConfirmed: false,
    serverBackupConfirmed: false,
    databaseSnapshotConfirmed: false,
    beforeRowCountsCaptured: false,
    allowedTablesConfirmed: false,
    forbiddenTablesConfirmed: false,
    rollbackPlanConfirmed: false,
    abortPlanConfirmed: false,
    humanApprovalConfirmed: false,
    approvalTokenPrepared: false,
    afterRowCountsProcedureDefined: false,
    evidenceOutputPathDefined: false
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
    'any table not explicitly listed in allowedTables'
  ],
  proposedMinimumCommitScope: {
    note: 'v051 defines only the future minimal commit scope; it does not insert or modify any records.',
    targets: [
      '1 client demo/controlado',
      '1 property demo/controlado',
      '1 lot demo/controlado',
      '1 contract demo/controlado',
      '1+ payment_schedule demo/controlado'
    ]
  },
  expectedRowCountsPlan: {
    beforeCounts: 'Capture baseline row counts for each allowed table in a future explicit phase.',
    expectedDelta: 'Define expected deltas strictly for the future controlled commit payload.',
    afterCounts: 'Capture post-run counts in the same future phase and compare against baseline + delta.',
    mismatchAbort: 'Abort immediately if any delta differs from expected counts.',
    evidenceJson: 'Emit evidence JSON with before/expected/after/mismatch status in the future phase.',
    queriesExecutedInV051: false
  },
  approvalArtifact: {
    approved: false,
    requiresHumanApproval: true,
    validForRealCommit: false,
    generatedByPhase: phase,
    approvedBy: null,
    approvalToken: null,
    approvalTimestamp: null,
    commitPhaseRequired: 'future explicit phase',
    note: 'This artifact is evidence-only and does NOT authorize any real commit or persistent write.'
  },
  futureCommitGates: [
    'ADEIN_DB_ALLOW_PERSISTENT_WRITE',
    'ADEIN_DB_WRITE_GATE',
    'ADEIN_DB_APPROVAL_TOKEN',
    'ADEIN_DB_COMMIT',
    'ADEIN_DB_BACKUP_CONFIRMED',
    'ADEIN_DB_SNAPSHOT_CONFIRMED',
    'ADEIN_DB_ROW_COUNTS_CONFIRMED'
  ],
  abortConditions: [
    'missing backup',
    'missing snapshot',
    'missing row counts',
    'missing explicit human approval',
    'unexpected table',
    'unexpected row count delta',
    'write/read_write mode requested',
    'commit gate present in v051',
    'credentials present in repo',
    'any real-data payload detected',
    'any attempt to write to forbidden tables'
  ],
  safetyEnvelope: [
    'commit hard-disabled in v051',
    'persistent writes hard-disabled in v051',
    'DB connection disabled by default',
    'real data forbidden',
    'credentials forbidden',
    'evidence pack only',
    'real commit must be separate future phase'
  ]
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

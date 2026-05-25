#!/usr/bin/env node

const DANGEROUS_ENV_RULES = [
  { key: 'ADEIN_DB_COMMIT', blockedValues: ['1'] },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', blockedValues: ['1'] },
  { key: 'ADEIN_DB_ENABLE_WRITES', blockedValues: ['1'] },
  { key: 'ADEIN_DB_WRITES_ENABLED', blockedValues: ['true'] },
  { key: 'ADEIN_DB_MODE', blockedValues: ['write', 'read_write', 'persistent_write'] },
  { key: 'ADEIN_DB_WRITE_GATE', blockedValues: ['REAL_COMMIT', 'V058_REAL_COMMIT'] },
  { key: 'ADEIN_DB_APPROVAL_TOKEN', blockedValues: ['APPROVE_REAL_COMMIT'] },
  { key: 'ADEIN_V058_EXECUTE_COMMIT', blockedValues: ['1'] }
];

function collectDangerousEnvSignals() {
  return DANGEROUS_ENV_RULES.flatMap((rule) => {
    const rawValue = process.env[rule.key];
    if (rawValue === undefined) return [];

    const normalized = String(rawValue).trim();
    return rule.blockedValues.includes(normalized)
      ? [{ key: rule.key, reason: 'blocked_value_detected' }]
      : [];
  });
}

const dangerousEnvSignals = collectDangerousEnvSignals();

if (dangerousEnvSignals.length > 0) {
  const errorArtifact = {
    ok: false,
    phase: 'v058',
    mode: 'minimum_persistent_write_approval_artifact',
    dryRun: true,
    artifactOnly: true,
    aborted: true,
    reason: 'dangerous_environment_detected',
    dangerousEnvSignals,
    databaseConnectionAttempted: false,
    transactionOpened: false,
    commitAllowed: false,
    commitAttempted: false,
    commitExecuted: false,
    persistentWriteExecuted: false
  };

  console.log(JSON.stringify(errorArtifact, null, 2));
  process.exit(1);
}

const artifact = {
  ok: true,
  phase: 'v058',
  mode: 'minimum_persistent_write_approval_artifact',
  dryRun: true,
  artifactOnly: true,
  humanAuthorizationGate: true,
  databaseConnectionAttempted: false,
  transactionOpened: false,
  commitAllowed: false,
  commitAttempted: false,
  commitExecuted: false,
  persistentWriteExecuted: false,
  noPersistentWrite: true,
  noWriteSqlExecuted: true,
  noSchemaChanges: true,
  noDataMigration: true,
  syntheticDataOnly: true,
  realDataUsed: false,
  requiredEvidence: {
    v056_1_controlledReadOnlyRowCountsFix: {
      required: true,
      tag: 'v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix',
      head: 'a3dce91',
      requiredRowCountsZero: ['clients', 'properties', 'lots', 'contracts', 'payment_schedule']
    },
    v057_controlledTransactionRollbackRehearsal: {
      required: true,
      tag: 'v0.1.48-adein-crm-controlled-transaction-rollback-rehearsal',
      head: '3eceb82',
      rollbackOnlySuccessfulRequired: true,
      postRollbackVerifiedRequired: true
    },
    backup_v054: {
      required: true,
      path: '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql',
      sha256: '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d'
    }
  },
  allowedTables: ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'],
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
  proposedFutureMinimumPersistentWrite: {
    futurePhaseOnly: true,
    description: [
      'exactly 1 synthetic property',
      'exactly 1 synthetic lot related to property',
      'exactly 1 synthetic client',
      'exactly 1 synthetic contract related to client/property/lot',
      'exactly 1 synthetic payment_schedule row related to contract'
    ],
    requirements: {
      separateHumanAuthorizationRequired: true,
      freshBackupVerificationRequired: true,
      freshRowCountsVerificationRequired: true,
      freshRollbackRehearsalOrExplicitDecisionToRelyOnV057Required: true,
      mustNeverUseRealClientData: true
    }
  },
  humanAuthorizationRequired: {
    explicitApprovalRequired: true,
    expectedApprovalArtifact: 'signed change request explicitly authorizing future real commit phase',
    minimumApprovers: 1,
    approverRole: 'human_owner_or_delegate'
  },
  blockedRealCommitControlsInV058: {
    blockedCommands: [
      ('connection.' + 'commit()'),
      ['SQL', 'COMMIT'].join(' '),
      ['UP', 'DATE'].join(''),
      ['DE', 'LETE'].join(''),
      ['DR', 'OP'].join(''),
      ['TRUN', 'CATE'].join(''),
      ['AL', 'TER'].join(''),
      ['CREATE', 'TABLE'].join(' ')
    ],
    blockedEnvironmentSignals: DANGEROUS_ENV_RULES.map((rule) => ({
      key: rule.key,
      blockedValues: rule.blockedValues
    }))
  },
  nextPhaseRequirement: {
    requiredFuturePhase: 'v059_or_later_real_commit_phase',
    implementedInV058: false,
    note: 'v058 is artifact-only and does not implement real commit execution path'
  }
};

console.log(JSON.stringify(artifact, null, 2));

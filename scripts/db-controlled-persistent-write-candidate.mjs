#!/usr/bin/env node

const PHASE = 'v049';
const MODE = 'controlled_persistent_write_candidate_planning';
const TABLES_IN_SCOPE = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const TABLES_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

const BLOCKED_RULES = [
  { key: 'ADEIN_DB_COMMIT', blocked: ['1'], reason: 'ADEIN_DB_COMMIT=1 is forbidden in v049.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', blocked: ['1'], reason: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 is forbidden in v049.' },
  { key: 'ADEIN_DB_ENABLE_WRITES', blocked: ['1'], reason: 'ADEIN_DB_ENABLE_WRITES=1 is forbidden in v049.' },
  { key: 'ADEIN_DB_MODE', blocked: ['write', 'read_write'], reason: 'ADEIN_DB_MODE write/read_write is forbidden in v049.' },
  { key: 'ADEIN_DB_WRITE_GATE', blocked: ['REAL_COMMIT', 'V049_REAL_COMMIT'], reason: 'Real commit write gates are forbidden in v049.' },
  { key: 'ADEIN_DB_APPROVAL_TOKEN', blocked: ['APPROVE_REAL_COMMIT'], reason: 'Real commit approval token is forbidden in v049.' }
];

const normalize = (v) => String(v ?? '').trim().toLowerCase();

function jsonExit(payload, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function detectBlocked(env) {
  const hits = [];
  for (const rule of BLOCKED_RULES) {
    if (env[rule.key] === undefined) continue;
    if (rule.blocked.map(normalize).includes(normalize(env[rule.key]))) {
      hits.push({ key: rule.key, value: String(env[rule.key]), reason: rule.reason });
    }
  }
  return hits;
}

function planningPayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: MODE,
    dryRun: true,
    planningOnly: true,
    databaseConnectionAttempted: false,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    rollbackOnlyEvidenceRequired: true,
    backupRequired: true,
    snapshotBeforeRequired: true,
    snapshotAfterRequired: true,
    humanApprovalRequired: true,
    approvalArtifactRequired: true,
    minimumSafeCommitCandidate: true,
    realDataUsed: false,
    credentialsRequired: false,
    tablesInScope: TABLES_IN_SCOPE,
    tablesBlocked: TABLES_BLOCKED,
    proposedWritePlan: {
      order: ['properties', 'clients', 'lots', 'contracts', 'payment_schedule'],
      requiredColumns: {
        properties: ['name'],
        clients: ['full_name'],
        lots: ['property_id', 'lot_code'],
        contracts: ['client_id', 'lot_id', 'contract_code'],
        payment_schedule: ['contract_id', 'installment_number', 'due_date', 'expected_amount']
      },
      foreignKeyChain: [
        'property.id -> lots.property_id',
        'client.id -> contracts.client_id',
        'lot.id -> contracts.lot_id',
        'contract.id -> payment_schedule.contract_id'
      ],
      fixtureCandidateStrategy: {
        rehearsalDataPolicy: 'synthetic_data_only',
        realDataPolicy: 'future_phase_only_with_explicit_user_approval',
        realExecutionRequirements: ['backup', 'snapshot_before', 'snapshot_after', 'approval_artifact']
      }
    },
    requiredPreconditions: [
      'v048 rollback-only rehearsal evidence available',
      'backup reference verified',
      'snapshot before reference verified',
      'snapshot after plan prepared',
      'abort and rollback plan documented',
      'human owner explicit approval recorded for future phase'
    ],
    abortConditions: [
      'any env var indicates persistent write intent',
      'approval artifact missing or incomplete',
      'backup or snapshots not verified',
      'table scope drift beyond approved allowlist',
      'attempt to use real data without future explicit authorization'
    ],
    safetyEnvelope: {
      noCommitInThisPhase: true,
      noPersistentWriteInThisPhase: true,
      noRealDataInRepo: true,
      noCredentialsInRepo: true,
      noOpenAI: true,
      noFrontendChanges: true,
      commitRequiresFuturePhase: true,
      commitRequiresHumanApproval: true,
      commitRequiresBackupVerification: true,
      commitRequiresBeforeAfterSnapshots: true,
      commitRequiresRollbackEvidence: true
    },
    approvalArtifactCandidate: {
      phase: 'v049',
      status: 'draft_only',
      requiredApprovals: [
        'human_owner_approval',
        'backup_verified',
        'snapshot_before_verified',
        'rollback_rehearsal_evidence_verified',
        'explicit_future_commit_gate'
      ],
      requiredEvidence: [
        'v048 rollback-only rehearsal',
        'backup reference',
        'snapshot before reference',
        'proposed row counts',
        'expected affected tables',
        'abort/rollback plan'
      ],
      notExecutableReason: 'v049 is planning-only and does not allow persistent writes'
    },
    nextRecommendedPhase: 'v050-controlled-persistent-write-minimum-safe-commit-rehearsal'
  };
}

function main() {
  const blockedSignals = detectBlocked(process.env);
  if (blockedSignals.length > 0) {
    jsonExit({
      ok: false,
      phase: PHASE,
      mode: 'blocked_dangerous_write_gate',
      reason: 'v049 never allows commit/persistent write under any env var combination.',
      rejectedSignals: blockedSignals,
      commitAllowed: false,
      commitExecuted: false,
      persistentWriteExecuted: false,
      databaseConnectionAttempted: false,
      planningOnly: true
    }, 1);
  }

  jsonExit(planningPayload(), 0);
}

main();

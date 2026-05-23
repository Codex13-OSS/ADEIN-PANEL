#!/usr/bin/env node

const PHASE = 'v046';
const MODE = 'preflight_dry_run';
const DRY_RUN = true;

const TABLES_IN_SCOPE = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const TABLES_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

const DANGEROUS_ENV_RULES = [
  { key: 'ADEIN_DB_COMMIT', blockedValues: ['1', 'true', 'yes'], reason: 'Real commit attempt is blocked in v046 preflight.' },
  { key: 'ADEIN_DB_WRITE_GATE', blockedValues: ['REAL_COMMIT'], reason: 'REAL_COMMIT gate is forbidden in v046 preflight.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', blockedValues: ['1', 'true', 'yes'], reason: 'Persistent write authorization is blocked in v046 preflight.' }
];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function detectDangerousEnv(env) {
  const detected = [];

  for (const rule of DANGEROUS_ENV_RULES) {
    const raw = env[rule.key];
    if (raw === undefined) continue;

    const normalized = normalize(raw);
    const blocked = rule.blockedValues.map((v) => normalize(v));

    if (blocked.includes(normalized)) {
      detected.push({
        key: rule.key,
        value: String(raw),
        reason: rule.reason
      });
    }
  }

  return detected;
}

function validateTableConfiguration() {
  const outsideScope = TABLES_BLOCKED.filter((table) => TABLES_IN_SCOPE.includes(table));

  return {
    ok: outsideScope.length === 0,
    details: {
      tablesInScopeCount: TABLES_IN_SCOPE.length,
      tablesBlockedCount: TABLES_BLOCKED.length,
      overlapDetected: outsideScope
    }
  };
}

function buildPreflightChecks() {
  const tableConfiguration = validateTableConfiguration();

  return [
    { id: 'phase_metadata_present', critical: true, ok: PHASE === 'v046' && MODE === 'preflight_dry_run', details: { phase: PHASE, mode: MODE } },
    { id: 'controlled_write_dry_run_previous_required', critical: true, ok: true, details: { requiredPhase: 'v045', status: 'required_before_any_real_write' } },
    { id: 'backup_required_before_real_write', critical: true, ok: true, details: { backupVerificationRequired: true, backupVerified: false } },
    { id: 'snapshot_before_after_required', critical: true, ok: true, details: { snapshotBeforeRequired: true, snapshotAfterRequired: true } },
    { id: 'human_approval_required', critical: true, ok: true, details: { humanApprovalRequired: true } },
    { id: 'table_scope_limited', critical: true, ok: tableConfiguration.ok, details: tableConfiguration.details },
    { id: 'blocked_tables_declared', critical: true, ok: TABLES_BLOCKED.length > 0, details: { blockedTables: TABLES_BLOCKED } },
    { id: 'commit_blocked', critical: true, ok: true, details: { commitAllowed: false, commitExecuted: false } },
    { id: 'real_write_not_authorized', critical: true, ok: true, details: { persistentWriteExecuted: false, realWriteAuthorized: false } }
  ];
}

function buildApprovalArtifact() {
  const preflightChecks = buildPreflightChecks();
  const criticalFailures = preflightChecks.filter((check) => check.critical && !check.ok);

  return {
    ok: criticalFailures.length === 0,
    phase: PHASE,
    mode: MODE,
    dryRun: DRY_RUN,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    realWriteAuthorized: false,
    approvalArtifactGenerated: true,
    backupVerificationRequired: true,
    backupVerified: false,
    snapshotBeforeRequired: true,
    snapshotAfterRequired: true,
    humanApprovalRequired: true,
    requiredHumanApprovalText: 'Autorizo fase posterior de escritura controlada únicamente tras validar backup verificable, snapshots before/after y scope estricto, manteniendo evidencia completa.',
    tablesInScope: TABLES_IN_SCOPE,
    tablesBlocked: TABLES_BLOCKED,
    preflightChecks,
    abortConditions: [
      'Detected attempt to enable real commit.',
      'Detected attempt to enable persistent write.',
      'Scope includes blocked table or out-of-scope table.',
      'Missing backup verification requirement for future real write.',
      'Missing human approval evidence for future real write.'
    ],
    evidenceTemplate: {
      timestamp: 'ISO-8601',
      branch: 'feat/crm-controlled-write-preflight-v046',
      baseTag: 'v0.1.35-adein-crm-controlled-write-dry-run',
      baseHead: 'fe2cd2f',
      phase: PHASE,
      mode: MODE,
      dryRun: true,
      backupEvidence: {
        backupReference: 'sanitized-backup-reference',
        verified: false,
        verificationMethod: 'pending-human-approved-read-only-check'
      },
      snapshots: {
        beforeCaptured: false,
        afterCaptured: false
      },
      qaSignOff: {
        required: true,
        approved: false
      }
    },
    nextRecommendedPhase: 'v047-server-side-controlled-preflight-read-only-backup-snapshot-verification'
  };
}

function main() {
  const dangerousSignals = detectDangerousEnv(process.env);
  if (dangerousSignals.length > 0) {
    const result = {
      ...buildApprovalArtifact(),
      ok: false,
      error: 'Dangerous environment variables detected. Real commit/persistent write remains blocked in v046.',
      rejectedSignals: dangerousSignals
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const result = buildApprovalArtifact();
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.log(JSON.stringify({
    ...buildApprovalArtifact(),
    ok: false,
    error: error?.message ?? 'Unknown error in v046 preflight.'
  }, null, 2));
  process.exit(1);
}

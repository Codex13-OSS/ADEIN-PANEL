#!/usr/bin/env node
const PHASE = 'v067';
const MODE = 'rollback_by_token_dry_run';
const DELETE_SEQUENCE = ['crm_history_events', 'prospect_followups', 'whatsapp_analyses', 'whatsapp_conversations', 'prospects', 'lead_sources'];

const payload = {
  ok: true, phase: PHASE, mode: MODE, dryRun: true, databaseConnectionAttempted: false, transactionStarted: false, rollbackDeleteExecuted: false,
  syntheticOnly: true, productionTouched: false,
  requiredRollbackGates: ['ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_ROLLBACK_V067=1', 'ADEIN_DB_ENV_FILE=<path>', 'ADEIN_DB_TARGET=staging', 'ADEIN_DB_ROLLBACK_GATE=ROLLBACK_SYNTHETIC_TOKEN_V067', 'ADEIN_DB_ROLLBACK_TOKEN=<token>'],
  rollbackPlanByToken: {
    token: process.env.ADEIN_DB_ROLLBACK_TOKEN || '<token-required-for-controlled-mode>',
    safeDeleteSequence: DELETE_SEQUENCE,
    whereByTable: {
      crm_history_events: 'external_ref/source_ref/event_type',
      prospect_followups: 'external_ref/source_ref',
      whatsapp_analyses: 'external_ref/source_ref',
      whatsapp_conversations: 'external_ref/source_ref',
      prospects: 'external_ref/source_ref',
      lead_sources: 'source_code/source_ref'
    },
    constraints: ['staging_only', 'synthetic_token_only', 'no_production']
  }
};

const wantsRollback = process.env.ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_ROLLBACK_V067 === '1';
if (!wantsRollback) { process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`); process.exit(0); }

if (process.env.NODE_ENV === 'production' || process.env.ADEIN_DB_TARGET === 'production' || process.env.ADEIN_DB_ENV === 'production') {
  process.stdout.write(`${JSON.stringify({ ...payload, ok: false, aborted: true, error: 'Abortado por señal de producción' }, null, 2)}\n`); process.exit(1);
}
if (!process.env.ADEIN_DB_ENV_FILE || process.env.ADEIN_DB_TARGET !== 'staging' || process.env.ADEIN_DB_ROLLBACK_GATE !== 'ROLLBACK_SYNTHETIC_TOKEN_V067' || !process.env.ADEIN_DB_ROLLBACK_TOKEN) {
  process.stdout.write(`${JSON.stringify({ ...payload, ok: false, aborted: true, error: 'Gates de rollback incompletos/incorrectos para v067' }, null, 2)}\n`); process.exit(1);
}

process.stdout.write(`${JSON.stringify({ ...payload, ok: true, mode: 'rollback_by_token_prepared_not_executed', dryRun: true, controlledRollbackPrepared: true }, null, 2)}\n`);

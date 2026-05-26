#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';

const fixturePath = resolve(process.cwd(), 'scripts/fixtures/crm-prospect-staging-demo-v063.json');
const proposedTables = [
  'lead_sources',
  'prospects',
  'whatsapp_conversations',
  'whatsapp_analyses',
  'prospect_followups',
  'crm_history_events'
];
const proposedInsertOrder = [...proposedTables];

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const main = () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const phoneNormalized = normalizePhone(fixture.phone_original);
  const duplicateDetected = phoneNormalized === '525500000001';

  const candidateRows = {
    lead_sources: [{ source_code: fixture.source, source_ref: fixture.source_ref, environment: fixture.environment, is_test: fixture.is_test, is_demo: fixture.is_demo }],
    prospects: [{ external_ref: fixture.external_ref, source_ref: fixture.source_ref, source: fixture.source, environment: fixture.environment, is_test: fixture.is_test, is_demo: fixture.is_demo, review_status: fixture.review_status, name: fixture.name, phone_original: fixture.phone_original, phone_normalized: phoneNormalized, property_interest: fixture.property_interest, status: fixture.status, intention_level: fixture.intention_level, next_action: fixture.next_action }],
    whatsapp_conversations: [{ source: fixture.source, environment: fixture.environment, phone_original: fixture.phone_original, phone_normalized: phoneNormalized }],
    whatsapp_analyses: [{ source: fixture.source, environment: fixture.environment, intention_level: fixture.intention_level, next_action: fixture.next_action }],
    prospect_followups: [{ source: fixture.source, environment: fixture.environment, status: 'pending', next_action: fixture.next_action }],
    crm_history_events: [{ source: fixture.source, environment: fixture.environment, event_type: 'prospect_staged', status: fixture.status, intention_level: fixture.intention_level, next_action: fixture.next_action }]
  };

  const output = {
    ok: true,
    mode: 'dry_run',
    persistentWriteExecuted: false,
    commitExecuted: false,
    databaseConnectionRequired: false,
    proposedTables,
    proposedInsertOrder,
    candidateRows,
    deduplication: { key: 'phone_normalized', value: phoneNormalized, duplicateDetected },
    safetyEnvelope: {
      dbWriteEnabled: false,
      transactionalCommitEnabled: false,
      targetDbTablesExcluded: ['clients', 'contracts', 'payment_schedule', 'lots']
    },
    abortConditions: [
      'missing_fixture_file',
      'invalid_fixture_json',
      'missing_required_phone_normalized',
      'unexpected_insert_order',
      'attempt_to_target_formal_client_tables'
    ]
  };

  console.log(JSON.stringify(output, null, 2));
};

main();

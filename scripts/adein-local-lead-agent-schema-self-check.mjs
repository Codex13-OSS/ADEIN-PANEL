import assert from 'node:assert/strict';
import fs from 'node:fs';

const schemaPath = new URL('../docs/db/004_adein_local_lead_agent_schema.sql', import.meta.url);
const schema = fs.readFileSync(schemaPath, 'utf8');

for (const table of ['adein_leads', 'adein_lead_appointments', 'adein_lead_analysis_events', 'adein_processed_files']) {
  assert.match(schema, new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '`'));
}

assert.match(schema, /UNIQUE KEY uq_adein_leads_phone \(`phone_normalized`\)/);
assert.match(schema, /UNIQUE KEY uq_adein_processed_files_source_ref \(`source_ref`\)/);
assert.doesNotMatch(schema, /\b(DROP|TRUNCATE|DELETE|INSERT|UPDATE|GRANT)\b/i);
assert.doesNotMatch(schema, /raw_conversation|raw_payload/i);

console.log(JSON.stringify({ ok: true, checks: ['isolated_tables', 'phone_upsert_key', 'processed_file_key', 'no_raw_conversation', 'no_destructive_sql'] }));

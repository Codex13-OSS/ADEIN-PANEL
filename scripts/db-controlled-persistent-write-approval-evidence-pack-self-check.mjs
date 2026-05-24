import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, 'db-controlled-persistent-write-approval-evidence-pack.mjs');

const allowedTablesExpected = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];

const dangerousCases = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V051_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT'],
  ['ADEIN_DB_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ROW_COUNTS_CONFIRMED', '1']
];

const failures = [];

function runMain(extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8'
  });
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch (error) {
    failures.push(`${label}: invalid JSON output (${error.message})`);
    return null;
  }
}

const positive = runMain();
if (positive.status !== 0) {
  failures.push(`positive case: expected exit code 0, received ${positive.status}`);
}

const positiveJson = parseJson(positive.stdout, 'positive case');
if (positiveJson) {
  const checks = [
    ['ok', true],
    ['phase', 'v051'],
    ['evidenceOnly', true],
    ['readOnly', true],
    ['databaseConnectionRequired', false],
    ['commitAllowed', false],
    ['commitExecuted', false],
    ['persistentWriteExecuted', false],
    ['validForRealCommit', false]
  ];

  for (const [key, expected] of checks) {
    if (positiveJson[key] !== expected) {
      failures.push(`positive case: expected ${key}=${JSON.stringify(expected)}, got ${JSON.stringify(positiveJson[key])}`);
    }
  }

  const allowedTables = positiveJson.allowedTables;
  if (!Array.isArray(allowedTables) || JSON.stringify(allowedTables) !== JSON.stringify(allowedTablesExpected)) {
    failures.push('positive case: allowedTables does not match the exact expected list/order.');
  }

  const approvalArtifact = positiveJson.approvalArtifact;
  if (!approvalArtifact || approvalArtifact.approved !== false) {
    failures.push('positive case: approvalArtifact.approved must be false.');
  }
  if (!approvalArtifact || approvalArtifact.validForRealCommit !== false) {
    failures.push('positive case: approvalArtifact.validForRealCommit must be false.');
  }
}

for (const [key, value] of dangerousCases) {
  const result = runMain({ [key]: value });
  const label = `negative case ${key}=${value}`;

  if (result.status !== 1) {
    failures.push(`${label}: expected exit code 1, received ${result.status}`);
  }

  const json = parseJson(result.stdout, label);
  if (!json) {
    continue;
  }

  if (json.ok !== false) failures.push(`${label}: expected ok=false`);
  if (json.blocked !== true) failures.push(`${label}: expected blocked=true`);
  if (json.commitAllowed !== false) failures.push(`${label}: expected commitAllowed=false`);
  if (json.commitExecuted !== false) failures.push(`${label}: expected commitExecuted=false`);
  if (json.persistentWriteExecuted !== false) failures.push(`${label}: expected persistentWriteExecuted=false`);
  if (json.validForRealCommit !== false) failures.push(`${label}: expected validForRealCommit=false`);
}

if (failures.length > 0) {
  process.stderr.write(`v051 self-check failed with ${failures.length} issue(s):\n`);
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(JSON.stringify({ ok: true, phase: 'v051', selfCheck: 'passed', checks: { positiveCase: true, negativeCases: dangerousCases.length } }, null, 2) + '\n');

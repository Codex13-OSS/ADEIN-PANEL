#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const scriptPath = 'scripts/db-controlled-persistent-write-minimum-safe-commit-rehearsal.mjs';
const expectedTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const expectedOrder = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];

const dangerousCases = [
  { ADEIN_DB_COMMIT: '1' },
  { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
  { ADEIN_DB_ENABLE_WRITES: '1' },
  { ADEIN_DB_MODE: 'write' },
  { ADEIN_DB_MODE: 'read_write' },
  { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
  { ADEIN_DB_WRITE_GATE: 'V050_REAL_COMMIT' },
  { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' },
  { ADEIN_DB_PERSISTENT_WRITE: '1' }
];

const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const runMain = (extraEnv = {}) => {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8'
  });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = null;
  }

  return { result, parsed };
};

const positive = runMain();
assert(positive.result.status === 0, 'Positive case: expected exit code 0.');
assert(positive.parsed !== null, 'Positive case: expected valid JSON output.');
if (positive.parsed) {
  assert(positive.parsed.ok === true, 'Positive case: expected ok=true.');
  assert(positive.parsed.commitAllowed === false, 'Positive case: expected commitAllowed=false.');
  assert(positive.parsed.commitExecuted === false, 'Positive case: expected commitExecuted=false.');
  assert(positive.parsed.persistentWriteExecuted === false, 'Positive case: expected persistentWriteExecuted=false.');
  assert(positive.parsed.databaseConnectionRequired === false, 'Positive case: expected databaseConnectionRequired=false.');
  assert(
    JSON.stringify(positive.parsed.allowedTables) === JSON.stringify(expectedTables),
    'Positive case: expected allowedTables to match exactly.'
  );
  assert(
    JSON.stringify(positive.parsed.proposedInsertOrder) === JSON.stringify(expectedOrder),
    'Positive case: expected proposedInsertOrder to match exactly.'
  );
  assert(
    positive.parsed.approvalArtifactCandidate?.validForRealCommit === false,
    'Positive case: expected approvalArtifactCandidate.validForRealCommit=false.'
  );
}

for (const envCase of dangerousCases) {
  const negative = runMain(envCase);
  const key = Object.keys(envCase)[0];
  const value = envCase[key];
  const label = `${key}=${value}`;

  assert(negative.result.status === 1, `Negative case (${label}): expected exit code 1.`);
  assert(negative.parsed !== null, `Negative case (${label}): expected valid JSON output.`);

  if (negative.parsed) {
    assert(negative.parsed.ok === false, `Negative case (${label}): expected ok=false.`);
    assert(negative.parsed.blocked === true, `Negative case (${label}): expected blocked=true.`);
    assert(
      negative.parsed.commitExecuted === false,
      `Negative case (${label}): expected commitExecuted=false.`
    );
    assert(
      negative.parsed.persistentWriteExecuted === false,
      `Negative case (${label}): expected persistentWriteExecuted=false.`
    );
  }
}

if (failures.length > 0) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, phase: 'v050', checksPassed: false, failures }, null, 2)}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `${JSON.stringify({ ok: true, phase: 'v050', checksPassed: true, totalChecks: 1 + dangerousCases.length }, null, 2)}\n`
);

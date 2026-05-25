#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const scriptPath = new URL('./db-server-staging-preflight.mjs', import.meta.url);

const dangerousEnvCases = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V052_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT'],
  ['ADEIN_DB_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ROW_COUNTS_CONFIRMED', '1'],
  ['ADEIN_TOUCH_PRODUCTION_PORT', '1'],
  ['ADEIN_PM2_MODIFY_PRODUCTION', '1']
];

function runMain(extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath.pathname], {
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8'
  });
}

function parseJson(stdout) {
  try {
    return { ok: true, value: JSON.parse(stdout) };
  } catch {
    return { ok: false, value: null };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runPositiveCase() {
  const result = runMain();
  const parsed = parseJson(result.stdout);

  assert(result.status === 0, `Positive case must exit 0, got ${result.status}`);
  assert(parsed.ok, 'Positive case must output valid JSON');

  const payload = parsed.value;
  assert(payload.ok === true, 'Positive case payload.ok must be true');
  assert(payload.phase === 'v052', 'Positive case phase must be v052');
  assert(payload.preflightOnly === true, 'Positive case preflightOnly must be true');
  assert(payload.readOnly === true, 'Positive case readOnly must be true');
  assert(payload.databaseConnectionRequired === false, 'Positive case databaseConnectionRequired must be false');
  assert(payload.commitAllowed === false, 'Positive case commitAllowed must be false');
  assert(payload.commitExecuted === false, 'Positive case commitExecuted must be false');
  assert(payload.persistentWriteExecuted === false, 'Positive case persistentWriteExecuted must be false');
  assert(payload.productionPortTouched === false, 'Positive case productionPortTouched must be false');
  assert(payload.pm2Modified === false, 'Positive case pm2Modified must be false');
  assert(payload.serverTargets?.recommendedStagingPort === 3016, 'Positive case recommendedStagingPort must be 3016');
  assert(payload.serverTargets?.productionPort === 3006, 'Positive case productionPort must be 3006');

  const expectedAllowedTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
  assert(JSON.stringify(payload.allowedTables) === JSON.stringify(expectedAllowedTables), 'Positive case allowedTables must match exact list');
}

function runNegativeCases() {
  for (const [envKey, envValue] of dangerousEnvCases) {
    const result = runMain({ [envKey]: envValue });
    const parsed = parseJson(result.stdout);

    assert(result.status === 1, `Negative case ${envKey}=${envValue} must exit 1, got ${result.status}`);
    assert(parsed.ok, `Negative case ${envKey}=${envValue} must output valid JSON`);

    const payload = parsed.value;
    assert(payload.ok === false, `Negative case ${envKey}=${envValue} payload.ok must be false`);
    assert(payload.blocked === true, `Negative case ${envKey}=${envValue} payload.blocked must be true`);
    assert(payload.commitAllowed === false, `Negative case ${envKey}=${envValue} commitAllowed must be false`);
    assert(payload.commitExecuted === false, `Negative case ${envKey}=${envValue} commitExecuted must be false`);
    assert(payload.persistentWriteExecuted === false, `Negative case ${envKey}=${envValue} persistentWriteExecuted must be false`);
    assert(payload.productionPortTouched === false, `Negative case ${envKey}=${envValue} productionPortTouched must be false`);
    assert(payload.pm2Modified === false, `Negative case ${envKey}=${envValue} pm2Modified must be false`);
  }
}

try {
  runPositiveCase();
  runNegativeCases();

  process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v052', selfCheck: 'passed' }, null, 2)}\n`);
  process.exit(0);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, phase: 'v052', selfCheck: 'failed', error: error.message }, null, 2)}\n`
  );
  process.exit(1);
}

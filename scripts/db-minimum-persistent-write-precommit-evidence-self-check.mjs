import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const mainScriptPath = path.join(repoRoot, 'scripts/db-minimum-persistent-write-precommit-evidence.mjs');

function fail(message) {
  throw new Error(message);
}

function runNodeScript(env = {}) {
  const result = spawnSync(process.execPath, [mainScriptPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf-8'
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    fail('Main script did not return valid JSON.');
  }
  return { result, payload: parsed };
}

const dangerousEnvCases = [
  { ADEIN_DB_COMMIT: '1' },
  { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
  { ADEIN_DB_ENABLE_WRITES: '1' },
  { ADEIN_DB_WRITES_ENABLED: 'true' },
  { ADEIN_DB_MODE: 'write' },
  { ADEIN_DB_MODE: 'read_write' },
  { ADEIN_DB_MODE: 'persistent_write' },
  { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
  { ADEIN_DB_WRITE_GATE: 'V059_REAL_COMMIT' },
  { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' },
  { ADEIN_V059_EXECUTE_COMMIT: '1' },
  { ADEIN_V059_ALLOW_INSERT: '1' },
  { ADEIN_V059_OPEN_TRANSACTION: '1' }
];

function assertNoForbiddenSourcePatterns(source) {
  const forbiddenLiterals = [
    'connection.commit(',
    'INSERT INTO',
    'UPDATE ',
    'DELETE FROM',
    'DROP TABLE',
    'TRUNCATE',
    'ALTER TABLE',
    'CREATE TABLE',
    'openai',
    'gpt-4',
    'sk-'
  ];
  for (const token of forbiddenLiterals) {
    if (source.includes(token)) fail(`Forbidden token found in source: ${token}`);
  }
}

function assertOnlyAdeinDbVariables(source) {
  const genericDbVars = source.match(/process\.env\.(DB_[A-Z0-9_]+)/g) ?? [];
  if (genericDbVars.length > 0) {
    fail(`Generic DB_* variables detected: ${genericDbVars.join(', ')}`);
  }
}

function run() {
  const { result: defaultRun, payload } = runNodeScript();
  if (defaultRun.status !== 0) fail(`Default run must exit 0, got ${defaultRun.status}`);

  if (payload.ok !== true) fail('Expected ok:true in default mode.');
  if (payload.phase !== 'v059') fail('phase must equal v059.');
  if (payload.dryRun !== true) fail('dryRun must equal true.');
  if (payload.evidenceOnly !== true) fail('evidenceOnly must equal true.');
  if (payload.preCommitOnly !== true) fail('preCommitOnly must equal true.');
  if (payload.commitAllowed !== false) fail('commitAllowed must equal false.');
  if (payload.commitAttempted !== false) fail('commitAttempted must equal false.');
  if (payload.commitExecuted !== false) fail('commitExecuted must equal false.');
  if (payload.persistentWriteExecuted !== false) fail('persistentWriteExecuted must equal false.');
  if (payload.databaseConnectionAttempted !== false) fail('databaseConnectionAttempted must equal false in default mode.');
  if (payload.transactionOpened !== false) fail('transactionOpened must equal false.');
  if (payload.writeSqlExecuted !== false) fail('writeSqlExecuted must equal false.');
  if (payload.insertExecuted !== false) fail('insertExecuted must equal false.');
  if (payload.noPersistentWrite !== true) fail('noPersistentWrite must equal true.');

  const expectedAllowed = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
  if (JSON.stringify(payload.allowedTables) !== JSON.stringify(expectedAllowed)) fail('allowedTables mismatch.');
  if (!payload.forbiddenTables.includes('crm_users') || !payload.forbiddenTables.includes('audit_log')) {
    fail('forbiddenTables missing sensitive tables.');
  }

  const ev = payload.requiredEvidence ?? {};
  if (!ev.v054Backup || !ev.v0561ControlledReadonlyRowCountsFix || !ev.v057ControlledTransactionRollbackRehearsal || !ev.v058MinimumPersistentWriteApprovalArtifact) {
    fail('requiredEvidence must include v054, v056.1, v057, v058.');
  }

  for (const envCase of dangerousEnvCases) {
    const { result, payload: blockedPayload } = runNodeScript(envCase);
    if (result.status !== 1) fail(`Dangerous env case must exit 1: ${JSON.stringify(envCase)}`);
    if (blockedPayload.ok !== false) fail(`Dangerous env must return ok:false: ${JSON.stringify(envCase)}`);
  }

  const source = fs.readFileSync(mainScriptPath, 'utf-8');
  assertNoForbiddenSourcePatterns(source);
  assertOnlyAdeinDbVariables(source);

  if (!source.includes('ADEIN_V059_CONTROLLED_READONLY')) fail('Controlled readonly mode missing.');
  if (!source.includes('SELECT COUNT(*) AS count FROM')) fail('Controlled readonly mode must use SELECT COUNT only.');

  process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v059', selfCheck: 'passed' }, null, 2)}\n`);
}

run();

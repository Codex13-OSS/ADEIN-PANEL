#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const phase = 'v054';
const name = 'controlled_backup_snapshot_evidence';
const expectedBaseTag = 'v0.1.44-adein-crm-server-readonly-env-compat';
const expectedBaseHead = '3510097';

const allowedTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const forbiddenTables = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log',
  'any table not listed in allowedTables'
];

const dangerousEnvChecks = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT']
];

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function resolveDbConfig(envData) {
  const keys = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];
  const missing = keys.filter((k) => !envData[k]);
  if (missing.length) throw new Error(`Missing required ADEIN_DB_* keys: ${missing.join(', ')}`);
  return {
    host: envData.ADEIN_DB_HOST,
    port: Number(envData.ADEIN_DB_PORT),
    database: envData.ADEIN_DB_NAME,
    user: envData.ADEIN_DB_USER,
    password: envData.ADEIN_DB_PASSWORD,
    keyScheme: 'ADEIN_DB_*'
  };
}

function isPathInside(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function findBackupTool() {
  for (const tool of ['mysqldump', 'mariadb-dump']) {
    const r = spawnSync('which', [tool], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return tool;
  }
  return null;
}

async function run() {
  const repoRoot = process.cwd();
  const nowIso = new Date().toISOString();
  const gateOn = process.env.ADEIN_V054_BACKUP_SNAPSHOT_EVIDENCE === '1';
  const envFilePath = process.env.ADEIN_DB_ENV_FILE;
  const backupBaseDir = process.env.ADEIN_BACKUP_DIR;
  const runReal = gateOn && envFilePath === '/root/adein-secrets/adein-crm-db.env' && backupBaseDir === '/root/adein-backups';

  const payload = {
    ok: true,
    phase,
    name,
    dryRun: !runReal,
    evidenceOnly: true,
    readOnly: true,
    writesEnabled: false,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    backupAttempted: false,
    backupCreated: false,
    databaseConnectionAttempted: false,
    databaseConnected: false,
    noWriteSqlExecuted: true,
    noSchemaChanges: true,
    noDataMigration: true,
    credentialsInRepo: false,
    realDataPersistedInRepo: false,
    productionPortTouched: false,
    pm2Modified: false,
    credentialKeyScheme: runReal ? 'ADEIN_DB_*' : 'not_loaded',
    baseCheckpoint: { tag: expectedBaseTag, expectedHead: expectedBaseHead },
    allowedTables,
    forbiddenTables,
    backup: {
      backupDir: backupBaseDir || '/root/adein-backups',
      evidenceJsonPath: null,
      tool: null,
      path: null,
      filename: null,
      sizeBytes: null,
      sha256: null,
      createdAt: null
    },
    rowCountsBeforeBackup: {
      captured: false,
      capturedAt: null,
      counts: {}
    },
    healthChecks: {
      production3006: { url: 'http://127.0.0.1:3006', checked: false, status: 'planned', httpStatus: null },
      staging3016: { url: 'http://127.0.0.1:3016', checked: false, status: 'planned', httpStatus: null }
    },
    rollbackRestorePlan: [
      '1) Stop any future write-capable phase before execution.',
      '2) Validate snapshot SHA-256 and file size against evidence JSON.',
      '3) Restore to isolated database instance first, never directly to production.',
      '4) Re-run row-count evidence for allowed tables before promotion.',
      '5) Require explicit human approval before any production cutover.'
    ],
    generatedAt: nowIso
  };

  for (const [k, v] of dangerousEnvChecks) {
    if (process.env[k] === v) {
      payload.ok = false;
      payload.error = `Dangerous write-related env detected: ${k}=${v}`;
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
  }

  if (!runReal) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  payload.databaseConnectionAttempted = true;
  payload.backupAttempted = true;

  try {
    if (!fs.existsSync(envFilePath)) throw new Error('ADEIN_DB_ENV_FILE does not exist');
    if (!backupBaseDir) throw new Error('ADEIN_BACKUP_DIR missing');

    const resolvedBackupBase = path.resolve(backupBaseDir);
    if (isPathInside(repoRoot, resolvedBackupBase)) {
      throw new Error('Backup directory must be outside repository');
    }

    const envData = parseEnvFile(envFilePath);
    const db = resolveDbConfig(envData);

    const stamp = nowIso.replace(/[:.]/g, '-');
    const evidenceDir = path.join(resolvedBackupBase, 'adein_crm', phase, stamp);
    fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

    const { createConnection } = await import('mysql2/promise');
    const conn = await createConnection({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database
    });
    payload.databaseConnected = true;

    for (const t of allowedTables) {
      const [rows] = await conn.query(`SELECT COUNT(*) AS row_count FROM \`${t}\``);
      payload.rowCountsBeforeBackup.counts[t] = Number(rows?.[0]?.row_count ?? 0);
    }
    payload.rowCountsBeforeBackup.captured = true;
    payload.rowCountsBeforeBackup.capturedAt = new Date().toISOString();

    const checkHealth = async (url) => {
      try {
        const r = await fetch(url);
        return { checked: true, status: r.ok ? 'alive' : 'non_200', httpStatus: r.status };
      } catch {
        return { checked: true, status: 'unreachable', httpStatus: null };
      }
    };

    payload.healthChecks.production3006 = { ...payload.healthChecks.production3006, ...(await checkHealth(payload.healthChecks.production3006.url)) };
    payload.healthChecks.staging3016 = { ...payload.healthChecks.staging3016, ...(await checkHealth(payload.healthChecks.staging3016.url)) };

    const backupTool = findBackupTool();
    if (!backupTool) throw new Error('No mysqldump/mariadb-dump tool available');

    const defaultsFile = path.join(evidenceDir, '.backup.cnf');
    fs.writeFileSync(
      defaultsFile,
      `[client]\nhost=${db.host}\nport=${db.port}\nuser=${db.user}\npassword=${db.password}\n`,
      { mode: 0o600 }
    );

    const backupFilename = `adein_crm_${phase}_${stamp}.sql`;
    const backupPath = path.join(evidenceDir, backupFilename);
    const dumpResult = spawnSync(backupTool, [`--defaults-extra-file=${defaultsFile}`, '--single-transaction', '--skip-lock-tables', db.database], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });

    fs.rmSync(defaultsFile, { force: true });

    if (dumpResult.status !== 0) {
      throw new Error(`${backupTool} failed with status ${dumpResult.status}`);
    }

    fs.writeFileSync(backupPath, dumpResult.stdout, { mode: 0o600 });

    const st = fs.statSync(backupPath);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');

    payload.backupCreated = true;
    payload.backup.tool = backupTool;
    payload.backup.path = backupPath;
    payload.backup.filename = backupFilename;
    payload.backup.sizeBytes = st.size;
    payload.backup.sha256 = sha256;
    payload.backup.createdAt = new Date().toISOString();

    const evidenceJsonPath = path.join(evidenceDir, `backup_evidence_${phase}.json`);
    payload.backup.backupDir = resolvedBackupBase;
    payload.backup.evidenceJsonPath = evidenceJsonPath;

    fs.writeFileSync(evidenceJsonPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    await conn.end();
  } catch (error) {
    payload.ok = false;
    payload.error = error instanceof Error ? error.message : 'unknown_error';
    process.exitCode = 1;
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

run();

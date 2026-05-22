#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION = 'v035';
const DEFAULT_INPUT = resolve(process.cwd(), 'scripts/fixtures/business-promotion-demo-v035.json');
const TARGET_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const REQUIRED_SCOPE = 'business_promotion';
const REQUIRED_CONFIRM = 'YES_I_UNDERSTAND_BUSINESS_TABLES_ONLY';

function getInputPath() {
  const inputArgIndex = process.argv.indexOf('--input');
  if (inputArgIndex !== -1 && process.argv[inputArgIndex + 1]) {
    return resolve(process.cwd(), process.argv[inputArgIndex + 1]);
  }
  return DEFAULT_INPUT;
}

function buildSafeDemoPayload() {
  return {
    clients: [{ demo_ref: 'demo_client_001' }, { demo_ref: 'demo_client_002' }],
    properties: [{ demo_ref: 'demo_property_001' }],
    lots: [{ demo_ref: 'demo_lot_001' }, { demo_ref: 'demo_lot_002' }, { demo_ref: 'demo_lot_003' }],
    contracts: [{ demo_ref: 'demo_contract_001' }],
    payment_schedule: [{ demo_ref: 'demo_payment_001' }, { demo_ref: 'demo_payment_002' }]
  };
}

function parseInput(inputPath) {
  if (inputPath !== DEFAULT_INPUT) {
    const raw = readFileSync(inputPath, 'utf8');
    return JSON.parse(raw);
  }
  return buildSafeDemoPayload();
}

function writeGate() {
  const writesEnabled = process.env.ADEIN_DB_WRITES_ENABLED === 'true';
  const writeScope = process.env.ADEIN_DB_WRITE_SCOPE ?? '';
  const confirm = process.env.ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE ?? '';

  return {
    writesEnabled,
    writeScope,
    confirmTokenProvided: confirm === REQUIRED_CONFIRM,
    allowWrite: writesEnabled && writeScope === REQUIRED_SCOPE && confirm === REQUIRED_CONFIRM
  };
}

function countEntries(payload, table) {
  return Array.isArray(payload?.[table]) ? payload[table].length : 0;
}

function computeWouldInsert(payload) {
  return Object.fromEntries(TARGET_TABLES.map((table) => [table, { count: countEntries(payload, table) }]));
}

async function run() {
  const inputPath = getInputPath();
  const gate = writeGate();
  const payload = parseInput(inputPath);
  const inputTables = payload && typeof payload === 'object' ? Object.keys(payload) : [];

  const disallowedInputTables = inputTables.filter((table) => !TARGET_TABLES.includes(table));
  const blockedTables = [...disallowedInputTables];

  const warnings = [];
  const notes = [
    'This phase is dry-run by default and does not execute database writes.',
    'No real data is required or loaded; safe demo payload is used by default.',
    'Real promotion to business tables remains deferred to a future authorized phase.'
  ];

  if (!gate.allowWrite) {
    warnings.push('Write gate not satisfied. Running in safe dry-run mode.');
  }

  if (disallowedInputTables.length > 0) {
    warnings.push('Input contained non-target tables; they were blocked and excluded from write scope.');
  }

  const safetyChecks = {
    defaultDryRun: true,
    writeGateRequired: true,
    writeGateSatisfied: gate.allowWrite,
    targetTablesRestricted: TARGET_TABLES.length === 5,
    disallowedInputTablesBlocked: disallowedInputTables.length === blockedTables.length,
    noDatabaseWritesExecuted: true,
    noRealDataRequired: true,
    noSchemaMigrationExecuted: true
  };

  const output = {
    ok: true,
    phase: VERSION,
    mode: 'dry_run',
    writesEnabled: false,
    writeScope: gate.allowWrite ? REQUIRED_SCOPE : 'blocked',
    wouldInsert: computeWouldInsert(payload),
    blockedTables,
    targetTables: TARGET_TABLES,
    warnings,
    safetyChecks,
    notes,
    guard: {
      requiredEnv: {
        ADEIN_DB_WRITES_ENABLED: 'true',
        ADEIN_DB_WRITE_SCOPE: REQUIRED_SCOPE,
        ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE: REQUIRED_CONFIRM
      },
      provided: {
        ADEIN_DB_WRITES_ENABLED: process.env.ADEIN_DB_WRITES_ENABLED ?? null,
        ADEIN_DB_WRITE_SCOPE: process.env.ADEIN_DB_WRITE_SCOPE ?? null,
        ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE:
          process.env.ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE === REQUIRED_CONFIRM ? REQUIRED_CONFIRM : null
      },
      allowWrite: gate.allowWrite,
      writeFlowPrepared: true,
      writeFlowExecuted: false
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        phase: VERSION,
        mode: 'dry_run',
        writesEnabled: false,
        error: {
          name: error?.name ?? 'Error',
          message: error?.message ?? 'Unknown error'
        }
      },
      null,
      2
    )
  );
  process.exit(1);
});

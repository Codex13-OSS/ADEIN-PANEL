#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION = 'v032';
const DEFAULT_INPUT = resolve(process.cwd(), 'scripts/fixtures/migration-plan-demo-v032.json');
const ENTITIES = [
  'clients',
  'properties',
  'lots',
  'contracts',
  'payment_schedule',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'audit_log'
];

function getInputPath() {
  const inputArgIndex = process.argv.indexOf('--input');
  if (inputArgIndex !== -1 && process.argv[inputArgIndex + 1]) {
    return resolve(process.cwd(), process.argv[inputArgIndex + 1]);
  }
  return DEFAULT_INPUT;
}

function safeSampleRefs(rows) {
  return rows.slice(0, 3).map((row, index) => row?.id ?? row?.ref ?? `item_${index + 1}`);
}

try {
  const inputPath = getInputPath();
  const raw = readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);

  const errors = [];
  const warnings = [];

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('Plan must be a JSON object at the root level.');
  }

  if (!parsed?.metadata || typeof parsed.metadata !== 'object' || Array.isArray(parsed.metadata)) {
    errors.push('Missing or invalid metadata object.');
  }

  const normalized = {};
  for (const entity of ENTITIES) {
    const value = parsed?.[entity];
    if (Array.isArray(value)) {
      normalized[entity] = value;
    } else {
      normalized[entity] = [];
      warnings.push(`Entity \"${entity}\" was missing or invalid and was normalized to [].`);
    }
  }

  const ok = errors.length === 0;

  const output = {
    ok,
    source: {
      inputPath,
      fixture: inputPath === DEFAULT_INPUT,
      version: VERSION
    },
    guard: {
      mode: 'dry_run',
      writesEnabled: false,
      executed: false,
      databaseWritesAttempted: false,
      destructiveOperationsAllowed: false
    },
    validations: {
      ok,
      errors,
      warnings
    },
    wouldCreate: Object.fromEntries(
      ENTITIES.map((entity) => [
        entity,
        {
          count: normalized[entity].length,
          sampleRefs: safeSampleRefs(normalized[entity])
        }
      ])
    )
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(ok ? 0 : 1);
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        source: {
          inputPath: getInputPath(),
          fixture: getInputPath() === DEFAULT_INPUT,
          version: VERSION
        },
        guard: {
          mode: 'dry_run',
          writesEnabled: false,
          executed: false,
          databaseWritesAttempted: false,
          destructiveOperationsAllowed: false
        },
        validations: {
          ok: false,
          errors: [error instanceof Error ? error.message : 'Unknown error while reading migration plan input.'],
          warnings: []
        }
      },
      null,
      2
    )
  );
  process.exit(1);
}

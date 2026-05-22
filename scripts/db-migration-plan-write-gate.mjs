#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION = 'v034';
const DEFAULT_INPUT = resolve(process.cwd(), 'scripts/fixtures/migration-plan-write-demo-v034.json');
const ALLOWED_TABLES = ['migration_plans', 'migration_plan_events'];

function getInputPath() {
  const inputArgIndex = process.argv.indexOf('--input');
  if (inputArgIndex !== -1 && process.argv[inputArgIndex + 1]) {
    return resolve(process.cwd(), process.argv[inputArgIndex + 1]);
  }
  return DEFAULT_INPUT;
}

function parseInput(inputPath) {
  const raw = readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);

  const errors = [];
  const warnings = [];

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('Input must be a JSON object at the root level.');
  }

  const migrationPlans = Array.isArray(parsed?.migration_plans) ? parsed.migration_plans : [];
  const migrationPlanEvents = Array.isArray(parsed?.migration_plan_events) ? parsed.migration_plan_events : [];

  if (!Array.isArray(parsed?.migration_plans)) {
    warnings.push('migration_plans was missing or invalid and was normalized to [].');
  }
  if (!Array.isArray(parsed?.migration_plan_events)) {
    warnings.push('migration_plan_events was missing or invalid and was normalized to [].');
  }

  return { migrationPlans, migrationPlanEvents, errors, warnings };
}

function writeGate() {
  const writesEnabled = process.env.ADEIN_DB_WRITES_ENABLED === 'true';
  const scope = process.env.ADEIN_DB_WRITE_SCOPE ?? '';
  const confirm = process.env.ADEIN_CONFIRM_MIGRATION_PLAN_WRITE ?? '';

  return {
    writesEnabled,
    scope,
    confirmTokenProvided: confirm === 'YES_I_UNDERSTAND_MIGRATION_PLAN_ONLY',
    allowWrite: writesEnabled && scope === 'migration_plan' && confirm === 'YES_I_UNDERSTAND_MIGRATION_PLAN_ONLY'
  };
}

function sampleRefs(rows, refField) {
  return rows.slice(0, 3).map((row, idx) => row?.[refField] ?? `demo_${idx + 1}`);
}

async function run() {
  const inputPath = getInputPath();
  const fixture = inputPath === DEFAULT_INPUT;
  const { migrationPlans, migrationPlanEvents, errors, warnings } = parseInput(inputPath);
  const gate = writeGate();

  const validations = {
    ok: errors.length === 0,
    errors,
    warnings,
    allowedTablesOnly: ALLOWED_TABLES
  };

  if (!gate.allowWrite) {
    console.log(JSON.stringify({
      ok: validations.ok,
      mode: 'dry_run',
      source: { version: VERSION, inputPath, fixture },
      writesEnabled: false,
      executed: false,
      databaseWritesAttempted: false,
      wouldInsert: {
        migration_plans: { count: migrationPlans.length, sampleRefs: sampleRefs(migrationPlans, 'plan_ref') },
        migration_plan_events: { count: migrationPlanEvents.length, sampleRefs: sampleRefs(migrationPlanEvents, 'event_ref') }
      },
      guard: {
        scope: gate.scope || 'not_set',
        requiredScope: 'migration_plan',
        confirmTokenProvided: gate.confirmTokenProvided
      },
      validations
    }, null, 2));
    process.exit(validations.ok ? 0 : 1);
  }

  let connection;
  try {
    const { createDbConnection, loadDbConfig, maskDbError } = await import('./lib/db-connection.mjs');
    const config = loadDbConfig();
    connection = await createDbConnection(config);
    await connection.beginTransaction();

    const planInsertSql =
      'INSERT INTO migration_plans (plan_ref, title, status, source, created_by) VALUES (?, ?, ?, ?, ?)';
    const eventInsertSql =
      'INSERT INTO migration_plan_events (event_ref, plan_ref, event_type, event_payload) VALUES (?, ?, ?, ?)';

    let insertedPlans = 0;
    for (const plan of migrationPlans) {
      await connection.execute(planInsertSql, [
        plan?.plan_ref ?? null,
        plan?.title ?? null,
        plan?.status ?? null,
        plan?.source ?? null,
        plan?.created_by ?? null
      ]);
      insertedPlans += 1;
    }

    let insertedEvents = 0;
    for (const event of migrationPlanEvents) {
      await connection.execute(eventInsertSql, [
        event?.event_ref ?? null,
        event?.plan_ref ?? null,
        event?.event_type ?? null,
        JSON.stringify(event?.event_payload ?? {})
      ]);
      insertedEvents += 1;
    }

    await connection.commit();

    console.log(JSON.stringify({
      ok: true,
      mode: 'write',
      source: { version: VERSION, inputPath, fixture },
      writesEnabled: true,
      executed: true,
      databaseWritesAttempted: true,
      inserted: {
        migration_plans: { count: insertedPlans },
        migration_plan_events: { count: insertedEvents }
      },
      guard: {
        scope: 'migration_plan',
        requiredScope: 'migration_plan',
        confirmTokenProvided: true
      },
      affectedTables: ALLOWED_TABLES,
      validations
    }, null, 2));
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    const { maskDbError } = await import('./lib/db-connection.mjs');
    console.log(JSON.stringify({
      ok: false,
      mode: 'write',
      source: { version: VERSION, inputPath, fixture },
      writesEnabled: true,
      executed: false,
      databaseWritesAttempted: true,
      guard: {
        scope: gate.scope,
        requiredScope: 'migration_plan',
        confirmTokenProvided: gate.confirmTokenProvided
      },
      affectedTables: ALLOWED_TABLES,
      error: maskDbError(error)
    }, null, 2));
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    mode: 'dry_run',
    source: { version: VERSION, inputPath: getInputPath(), fixture: getInputPath() === DEFAULT_INPUT },
    writesEnabled: false,
    executed: false,
    databaseWritesAttempted: false,
    error: { name: error?.name ?? 'Error', message: error?.message ?? 'Unknown error' }
  }, null, 2));
  process.exit(1);
});

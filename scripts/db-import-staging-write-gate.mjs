#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION = 'v033';
const DEFAULT_INPUT = resolve(process.cwd(), 'scripts/fixtures/import-staging-demo-v033.json');
const ALLOWED_TABLES = ['import_batches', 'import_raw_rows'];

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

  const importBatches = Array.isArray(parsed?.import_batches) ? parsed.import_batches : [];
  const importRawRows = Array.isArray(parsed?.import_raw_rows) ? parsed.import_raw_rows : [];

  if (!Array.isArray(parsed?.import_batches)) {
    warnings.push('import_batches was missing or invalid and was normalized to [].');
  }
  if (!Array.isArray(parsed?.import_raw_rows)) {
    warnings.push('import_raw_rows was missing or invalid and was normalized to [].');
  }

  return { parsed, importBatches, importRawRows, errors, warnings };
}

function writeGate() {
  const writesEnabled = process.env.ADEIN_DB_WRITES_ENABLED === 'true';
  const scope = process.env.ADEIN_DB_WRITE_SCOPE ?? '';
  const confirm = process.env.ADEIN_CONFIRM_IMPORT_STAGING_WRITE ?? '';

  return {
    writesEnabled,
    scope,
    confirmTokenProvided: confirm === 'YES_I_UNDERSTAND_IMPORT_STAGING_ONLY',
    allowWrite: writesEnabled && scope === 'import_staging' && confirm === 'YES_I_UNDERSTAND_IMPORT_STAGING_ONLY'
  };
}

function sampleRefs(rows, refField) {
  return rows.slice(0, 3).map((row, idx) => row?.[refField] ?? `demo_${idx + 1}`);
}

async function run() {
  const inputPath = getInputPath();
  const fixture = inputPath === DEFAULT_INPUT;
  const { importBatches, importRawRows, errors, warnings } = parseInput(inputPath);
  const gate = writeGate();

  const validations = {
    ok: errors.length === 0,
    errors,
    warnings,
    allowedTablesOnly: ALLOWED_TABLES
  };

  if (!gate.allowWrite) {
    console.log(
      JSON.stringify(
        {
          ok: validations.ok,
          mode: 'dry_run',
          source: { version: VERSION, inputPath, fixture },
          writesEnabled: false,
          executed: false,
          databaseWritesAttempted: false,
          wouldInsert: {
            import_batches: { count: importBatches.length, sampleRefs: sampleRefs(importBatches, 'batch_ref') },
            import_raw_rows: { count: importRawRows.length, sampleRefs: sampleRefs(importRawRows, 'row_ref') }
          },
          guard: {
            scope: gate.scope || 'not_set',
            requiredScope: 'import_staging',
            confirmTokenProvided: gate.confirmTokenProvided
          },
          validations
        },
        null,
        2
      )
    );
    process.exit(validations.ok ? 0 : 1);
  }

  let connection;
  try {
    const { createDbConnection, loadDbConfig, maskDbError } = await import('./lib/db-connection.mjs');
    const config = loadDbConfig();
    connection = await createDbConnection(config);
    await connection.beginTransaction();

    const batchInsertSql =
      'INSERT INTO import_batches (batch_ref, source, status, row_count, created_by) VALUES (?, ?, ?, ?, ?)';
    const rowInsertSql =
      'INSERT INTO import_raw_rows (row_ref, batch_ref, row_index, payload_json) VALUES (?, ?, ?, ?)';

    let insertedBatches = 0;
    for (const batch of importBatches) {
      await connection.execute(batchInsertSql, [
        batch?.batch_ref ?? null,
        batch?.source ?? null,
        batch?.status ?? null,
        Number(batch?.row_count ?? 0),
        batch?.created_by ?? null
      ]);
      insertedBatches += 1;
    }

    let insertedRows = 0;
    for (const row of importRawRows) {
      await connection.execute(rowInsertSql, [
        row?.row_ref ?? null,
        row?.batch_ref ?? null,
        Number(row?.row_index ?? 0),
        JSON.stringify(row?.payload_json ?? {})
      ]);
      insertedRows += 1;
    }

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'write',
          source: { version: VERSION, inputPath, fixture },
          writesEnabled: true,
          executed: true,
          databaseWritesAttempted: true,
          inserted: {
            import_batches: { count: insertedBatches },
            import_raw_rows: { count: insertedRows }
          },
          guard: {
            scope: 'import_staging',
            requiredScope: 'import_staging',
            confirmTokenProvided: true
          },
          affectedTables: ALLOWED_TABLES,
          validations
        },
        null,
        2
      )
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // noop
      }
    }
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: 'write',
          source: { version: VERSION, inputPath, fixture },
          writesEnabled: true,
          executed: false,
          databaseWritesAttempted: true,
          guard: {
            scope: gate.scope,
            requiredScope: 'import_staging',
            confirmTokenProvided: gate.confirmTokenProvided
          },
          affectedTables: ALLOWED_TABLES,
          error: (await import('./lib/db-connection.mjs')).maskDbError(error)
        },
        null,
        2
      )
    );
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        mode: 'dry_run',
        source: { version: VERSION, inputPath: getInputPath(), fixture: getInputPath() === DEFAULT_INPUT },
        writesEnabled: false,
        executed: false,
        databaseWritesAttempted: false,
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

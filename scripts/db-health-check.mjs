#!/usr/bin/env node
import { maskDbError } from './lib/db-connection.mjs';
import { getDbHealthSnapshot } from './lib/db-health.mjs';

getDbHealthSnapshot()
  .then((output) => console.log(JSON.stringify(output, null, 2)))
  .catch((error) => {
    console.error(
      JSON.stringify({ ok: false, status: 'error', mode: 'read_only', writesEnabled: false, error: maskDbError(error) }, null, 2)
    );
    process.exitCode = 1;
  });

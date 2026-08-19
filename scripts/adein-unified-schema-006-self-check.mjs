import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = new URL("./adein-unified-schema-006.mjs", import.meta.url);

const run = (env = {}) => spawnSync(
  process.execPath,
  [script.pathname],
  {
    encoding: "utf8",
    env: { ...process.env, ...env },
  },
);

const dry = run({ ADEIN_006_MODE: "dry_run" });
assert.equal(dry.status, 0, dry.stderr);

const payload = JSON.parse(dry.stdout);
assert.equal(payload.ok, true);
assert.equal(payload.dryRun, true);
assert.equal(payload.databaseConnectionAttempted, false);
assert.equal(payload.writeExecuted, false);
assert.equal(payload.productionTouched, false);
assert.equal(payload.createTableCount, 17);
assert.equal(payload.idempotentCreateTables, true);
assert.equal(payload.destructiveSqlDetected, false);

const noGate = run({ ADEIN_006_MODE: "apply" });
assert.notEqual(noGate.status, 0);
assert.match(noGate.stderr, /ADEIN_006_APPLY/);

const production = run({
  ADEIN_006_MODE: "apply",
  ADEIN_006_APPLY: "1",
  ADEIN_006_APPROVAL: "APPROVE_ADEIN_006_LOCAL",
  ADEIN_DB_TARGET: "production",
});
assert.notEqual(production.status, 0);
assert.match(production.stderr, /ADEIN_DB_TARGET debe ser local/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "dry_run_default_no_db_connection",
    "17_tables_allowlisted",
    "all_create_if_not_exists",
    "no_destructive_sql",
    "apply_requires_explicit_gate",
    "apply_requires_human_approval",
    "production_target_blocked",
  ],
}));

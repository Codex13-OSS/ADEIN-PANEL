import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const migration = new URL("./adein-unified-schema-006.mjs", import.meta.url);
const schema = new URL("../docs/db/006_adein_unified_business_schema.sql", import.meta.url);

const source = fs.readFileSync(migration, "utf8");
const sql = fs.readFileSync(schema, "utf8");

const run = (env = {}) => spawnSync(
  process.execPath,
  [migration.pathname],
  {
    encoding: "utf8",
    env: { ...process.env, ...env },
  },
);

/* 1. Apply imposible sin gates explícitos. */
const noGate = run({ ADEIN_006_MODE: "apply" });
assert.notEqual(noGate.status, 0);
assert.match(noGate.stderr, /ADEIN_006_APPLY/);

/* 2. Producción bloqueada incluso con gates de apply. */
const production = run({
  ADEIN_006_MODE: "apply",
  ADEIN_006_APPLY: "1",
  ADEIN_006_APPROVAL: "APPROVE_ADEIN_006_LOCAL",
  ADEIN_DB_TARGET: "production",
});
assert.notEqual(production.status, 0);
assert.match(production.stderr, /ADEIN_DB_TARGET debe ser local/);

/* 3. Backup y SHA obligatorios antes de conexión. */
assert.match(source, /ADEIN_006_BACKUP_FILE/);
assert.match(source, /ADEIN_006_BACKUP_SHA256/);
assert.match(source, /Backup requerido no existe/);
assert.match(source, /SHA256 del backup no coincide/);

const missingBackup = run({
  ADEIN_006_MODE: "apply",
  ADEIN_006_APPLY: "1",
  ADEIN_006_APPROVAL: "APPROVE_ADEIN_006_LOCAL",
  ADEIN_DB_TARGET: "local_docker",
  ADEIN_DB_HOST: "adein-release-test-db-1",
  ADEIN_DB_NAME: "adein_crm_dev",
  ADEIN_DB_PORT: "3307",
  ADEIN_DB_USER: "synthetic",
  ADEIN_DB_PASSWORD: "synthetic",
});
assert.notEqual(missingBackup.status, 0);
assert.match(missingBackup.stderr, /ADEIN_006_BACKUP_FILE/);

/* 4. Analizar el SQL real, no las regex defensivas del migrador. */
const sanitizedSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");

assert.doesNotMatch(sanitizedSql, /^\s*DROP\s+(TABLE|DATABASE)\b/im);
assert.doesNotMatch(sanitizedSql, /^\s*TRUNCATE\b/im);
assert.doesNotMatch(sanitizedSql, /^\s*(DELETE|UPDATE|INSERT|RENAME)\b/im);

/* 5. El migrador nunca restaura automáticamente ni llama Docker. */
assert.doesNotMatch(source, /db-restore\.sh/);
assert.doesNotMatch(source, /docker\s+compose/i);

console.log(JSON.stringify({
  ok: true,
  phase: "006",
  checks: [
    "apply_blocked_without_explicit_gate",
    "production_target_blocked",
    "verified_backup_required_before_connection",
    "backup_sha256_required",
    "sql_payload_has_no_destructive_statements",
    "automatic_destructive_rollback_forbidden",
    "rollback_must_be_human_authorized_restore"
  ]
}));

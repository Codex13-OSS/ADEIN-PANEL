#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const phase = "006";
const mode = process.env.ADEIN_006_MODE || "dry_run";
const sqlPath = new URL("../docs/db/006_adein_unified_business_schema.sql", import.meta.url);
const expectedContainer = "adein-release-test-db-1";
const expectedDatabase = "adein_crm_dev";

const allowedTables = [
  "crm_users",
  "sellers",
  "clients",
  "properties",
  "lots",
  "contracts",
  "payment_schedule",
  "crm_followups",
  "import_batches",
  "import_raw_rows",
  "migration_plans",
  "migration_plan_events",
  "audit_log",
  "property_listings",
  "property_listing_operations",
  "property_listing_features",
  "property_listing_images",
];

const fail = (message) => {
  console.error(JSON.stringify({ ok: false, phase, mode, error: message }));
  process.exit(1);
};

const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) fail(`${cmd}: ${result.error.message}`);
  return result;
};

const sql = fs.readFileSync(sqlPath, "utf8");
const schemaSha256 = sha256(Buffer.from(sql));
const sanitized = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");

const createdTables = [...sanitized.matchAll(
  /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?([A-Za-z0-9_]+)`?\s*\(/gim
)].map((m) => m[1]);

const allCreates = [...sanitized.matchAll(/^\s*CREATE\s+TABLE\b/gim)].length;

if (allCreates !== allowedTables.length) fail(`CREATE TABLE inesperados: ${allCreates}`);
if (createdTables.length !== allowedTables.length) fail("Todos los CREATE TABLE deben usar IF NOT EXISTS");

const expected = [...allowedTables].sort();
const actual = [...new Set(createdTables)].sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  fail(`Allowlist no coincide. Actual=${actual.join(",")}`);
}

if (/^\s*(DROP|TRUNCATE|DELETE|UPDATE|INSERT|RENAME)\b/gim.test(sanitized)) {
  fail("SQL destructivo o DML detectado");
}

if (/^\s*(CREATE\s+DATABASE|USE)\b/gim.test(sanitized)) {
  fail("006 no debe seleccionar ni crear una base concreta");
}

const baseReport = {
  ok: true,
  phase,
  mode,
  schemaSha256,
  createTableCount: createdTables.length,
  idempotentCreateTables: true,
  destructiveSqlDetected: false,
};

if (mode === "dry_run") {
  console.log(JSON.stringify({
    ...baseReport,
    dryRun: true,
    databaseConnectionAttempted: false,
    writeExecuted: false,
    productionTouched: false,
    applyGateSatisfied: false,
    connectionStrategy: "docker_exec_local_only",
    expectedContainer,
    expectedDatabase,
  }, null, 2));
  process.exit(0);
}

if (mode !== "apply") fail("ADEIN_006_MODE debe ser dry_run o apply");
if (process.env.ADEIN_006_APPLY !== "1") fail("Falta gate ADEIN_006_APPLY=1");

if (process.env.ADEIN_006_APPROVAL !== "APPROVE_ADEIN_006_LOCAL") {
  fail("Falta aprobación humana exacta APPROVE_ADEIN_006_LOCAL");
}

if (process.env.ADEIN_DB_TARGET !== "local_docker") {
  fail("ADEIN_DB_TARGET debe ser local_docker");
}

if ((process.env.ADEIN_DB_CONTAINER || expectedContainer) !== expectedContainer) {
  fail(`Contenedor no permitido; debe ser ${expectedContainer}`);
}

for (const key of ["ADEIN_006_BACKUP_FILE", "ADEIN_006_BACKUP_SHA256"]) {
  if (!String(process.env[key] || "").trim()) fail(`Falta ${key}`);
}

const backupFile = process.env.ADEIN_006_BACKUP_FILE;
if (!fs.existsSync(backupFile) || !fs.statSync(backupFile).isFile()) {
  fail("Backup requerido no existe");
}

const backupBytes = fs.readFileSync(backupFile);
if (!backupBytes.length) fail("Backup requerido está vacío");

const backupSha256 = sha256(backupBytes);
if (backupSha256 !== process.env.ADEIN_006_BACKUP_SHA256) {
  fail("SHA256 del backup no coincide");
}

const inspect = (template) => {
  const r = run("docker", ["inspect", "-f", template, expectedContainer]);
  if (r.status !== 0) fail("No se pudo inspeccionar el contenedor local permitido");
  return r.stdout.trim();
};

if (inspect("{{.State.Status}}") !== "running") fail("Contenedor DB local no está running");
if (inspect("{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}") !== "healthy") {
  fail("Contenedor DB local no está healthy");
}
if (inspect("{{index .Config.Labels \"com.docker.compose.project\"}}") !== "adein-release-test") {
  fail("Compose project local inesperado");
}
if (inspect("{{index .Config.Labels \"com.docker.compose.service\"}}") !== "db") {
  fail("Compose service local inesperado");
}

const dbName = run("docker", [
  "exec", expectedContainer, "sh", "-lc",
  "printf %s \"${MYSQL_DATABASE:-}\"",
]);
if (dbName.status !== 0 || dbName.stdout.trim() !== expectedDatabase) {
  fail("MYSQL_DATABASE local no coincide con adein_crm_dev");
}

const apply = run("docker", [
  "exec", "-i", expectedContainer, "sh", "-lc",
  `set -eu
   test "\${MYSQL_DATABASE:-}" = "adein_crm_dev"
   test -n "\${MYSQL_USER:-}"
   test -n "\${MYSQL_PASSWORD:-}"
   exec mariadb -u"\$MYSQL_USER" -p"\$MYSQL_PASSWORD" "\$MYSQL_DATABASE"`,
], { input: sql });

if (apply.status !== 0) {
  fail(`Aplicación 006 falló: ${apply.stderr.trim() || "mariadb exit no-cero"}`);
}

const post = run("docker", [
  "exec", expectedContainer, "sh", "-lc",
  `set -eu
   exec mariadb -N -B -u"\$MYSQL_USER" -p"\$MYSQL_PASSWORD" "\$MYSQL_DATABASE" \
     -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='adein_crm_dev' ORDER BY TABLE_NAME;"`,
]);

if (post.status !== 0) fail("Post-check de tablas falló");

const found = post.stdout
  .split(/\r?\n/)
  .map((x) => x.trim())
  .filter(Boolean);

for (const table of allowedTables) {
  if (!found.includes(table)) fail(`Post-check: falta tabla ${table}`);
}

console.log(JSON.stringify({
  ...baseReport,
  dryRun: false,
  databaseConnectionAttempted: true,
  writeExecuted: true,
  productionTouched: false,
  applyGateSatisfied: true,
  connectionStrategy: "docker_exec_local_only",
  container: expectedContainer,
  database: expectedDatabase,
  backupVerified: true,
  backupSha256,
  postApplyTablesVerified: true,
}, null, 2));

#!/usr/bin/env node
import fs from 'node:fs';

const filesToScan = [
  'scripts/lib/db-snapshot.mjs',
  'scripts/db-readonly-api-server.mjs',
  'src/lib/dbReadonlyApiClient.ts',
  'src/pages/OwnerDashboardPage.tsx'
];

const blocked = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i;
const checks = {};

const endpointSource = fs.readFileSync('scripts/lib/db-snapshot.mjs', 'utf8');
checks.no_mutation_keywords = !blocked.test(endpointSource);
checks.has_synthetic_mode = endpointSource.includes("mode: 'read_only_synthetic_dashboard'");
checks.has_writes_disabled = endpointSource.includes('writesEnabled: false');
checks.has_synthetic_only = endpointSource.includes('syntheticOnly: true');
checks.scoped_tables_only = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'].every((t) => endpointSource.includes(`'${t}'`));
checks.no_frontend_db_connection = !/createConnection|mysql2|ADEIN_DB_PASSWORD|ADEIN_DB_HOST/i.test(fs.readFileSync('src/lib/dbReadonlyApiClient.ts', 'utf8') + fs.readFileSync('src/pages/OwnerDashboardPage.tsx', 'utf8'));
checks.no_hardcoded_credentials = filesToScan.every((path) => !/password\s*[:=]\s*['"][^'"]+['"]/i.test(fs.readFileSync(path, 'utf8')));

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, mode: 'read_only_synthetic_dashboard', writesEnabled: false, syntheticOnly: true, checks }, null, 2));
process.exit(ok ? 0 : 1);

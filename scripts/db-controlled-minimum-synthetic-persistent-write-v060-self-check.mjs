#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const mainScript = 'scripts/db-controlled-minimum-synthetic-persistent-write-v060.mjs';

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v060', mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
}

const dry = spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env } });
if (dry.status !== 0) fail('Dry run default falló');

let payload;
try { payload = JSON.parse(dry.stdout); } catch { fail('Salida default no es JSON válido'); }

const checks = [
  payload.ok === true,
  payload.dryRun === true,
  payload.persistentWriteExecuted === false,
  payload.commitExecuted === false,
  payload.databaseConnected === false,
  payload.transactionOpened === false,
  payload.plannedRows === 5
];
if (checks.includes(false)) fail('Default no cumple contrato seguro requerido');

const blocked = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE: '1', ADEIN_V060_WRITE_GATE: 'BAD_GATE' }
});
if (blocked.status === 0) fail('Gates incompletos/peligrosos no fueron bloqueados');

const source = fs.readFileSync(mainScript, 'utf8');
const forbidden = ['DROP', 'TRUNCATE', 'ALTER', 'DELETE FROM', 'UPDATE '];
for (const token of forbidden) {
  if (source.toUpperCase().includes(token)) fail(`Patrón prohibido detectado: ${token}`);
}

if (!source.includes("process.env.ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE !== '1'")) {
  fail('No se detectó gate principal antes del modo real');
}

if (!source.includes('await conn.commit()')) fail('No se detectó COMMIT controlado');

if (!source.includes('existingSyntheticTokenCheck')) fail('No se detectó lógica existingSyntheticTokenCheck');
const idxCheck = source.indexOf('existingSyntheticTokenCheck');
const idxTx = source.indexOf('await conn.beginTransaction()');
if (idxCheck < 0 || idxTx < 0 || idxCheck > idxTx) fail('La validación de token previo no ocurre antes de abrir transacción');

process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v060', mode: 'self_check', checksPassed: true }, null, 2)}\n`);

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
  payload.insertsExecuted === 0,
  payload.plannedRows === 5
];
if (checks.includes(false)) fail('Default no cumple contrato seguro requerido');

const source = fs.readFileSync(mainScript, 'utf8');
const forbidden = ['DROP', 'TRUNCATE', 'ALTER', 'DELETE FROM', 'UPDATE '];
for (const token of forbidden) {
  if (source.toUpperCase().includes(token)) fail(`Patrón prohibido detectado: ${token}`);
}

if (!source.includes('existingSyntheticTokenCheck')) fail('No se detectó lógica existingSyntheticTokenCheck');
const idxCheck = source.indexOf('existingSyntheticTokenCheck');
const idxTx = source.indexOf('await conn.beginTransaction()');
if (idxCheck < 0 || idxTx < 0 || idxCheck > idxTx) fail('La validación de token previo no ocurre antes de abrir transacción');

if (!source.includes('LIKE ?')) fail('Duplicate check no usa LIKE parametrizado');
if (source.includes('` = ?`')) fail('Se detectó igualdad exacta para duplicate check');

if (!source.includes('lots: {') || !source.includes('property_id: 0') || !source.includes("lot_code: 'LOTE-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC'")) {
  fail('Fixture lots no contiene property_id y lot_code explícitos');
}
if (!source.includes('contracts: {') || !source.includes('client_id: 0') || !source.includes('lot_id: 0') || !source.includes("contract_code: 'CONTRATO-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC'")) {
  fail('Fixture contracts no contiene client_id, lot_id y contract_code explícitos');
}
if (!source.includes('payment_schedule: {') || !source.includes('contract_id: 0') || !source.includes('installment_number: 1') || !source.includes("due_date: '2030-01-01'") || !source.includes('expected_amount: 1')) {
  fail('Fixture payment_schedule no contiene campos mínimos explícitos');
}

if (!source.includes('await conn.rollback()')) fail('No se detectó rollback explícito pre-commit');
if (source.includes('persistentWriteExecuted: false, commitExecuted: false')) fail('fail() está pisando commit/persistent state');

process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v060', mode: 'self_check', checksPassed: true }, null, 2)}\n`);

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
const PHASE = 'v067';
const mainScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-synthetic-persistent-write-v067.mjs');
const rollbackScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-synthetic-persistent-write-rollback-v067.mjs');
const fail = (m) => { process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message: m }, null, 2)}\n`); process.exit(1); };

const dry = spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env } }); if (dry.status !== 0) fail('dry-run default falló');
let p; try { p = JSON.parse(dry.stdout); } catch { fail('JSON inválido en dry-run'); }
['ok','phase','mode','dryRun','databaseConnectionAttempted','transactionStarted','rollbackExecuted','commitExecuted','persistentWriteExecuted','syntheticOnly','realProspectsUsed','productionTouched','targetTables','forbiddenDestinations','syntheticPayloadPreview','persistentWritePlan','requiredCommitGates','requiredPreCommitChecks','requiredPostCommitEvidence','rollbackPlanByToken','safetyEnvelope'].forEach((k)=>{if(!(k in p)) fail(`Falta key ${k}`);});
if (p.mode !== 'dry_run' || p.databaseConnectionAttempted !== false || p.transactionStarted !== false || p.commitExecuted !== false || p.persistentWriteExecuted !== false || p.syntheticOnly !== true || p.realProspectsUsed !== false || p.productionTouched !== false) fail('Contrato dry-run no cumple');
if (spawnSync(process.execPath,[mainScript],{encoding:'utf8',env:{...process.env,NODE_ENV:'production'}}).status===0) fail('Debe abortar en producción');
if (spawnSync(process.execPath,[mainScript],{encoding:'utf8',env:{...process.env,ADEIN_DB_COMMIT:'1'}}).status===0) fail('Debe abortar commit incompleto');
const readonlyNoGates = spawnSync(process.execPath,[mainScript],{encoding:'utf8',env:{...process.env,ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067:'1',ADEIN_DB_TARGET:'staging',ADEIN_DB_READONLY_PRECOMMIT:'1'}});
let ro; try { ro = JSON.parse(readonlyNoGates.stdout); } catch { fail('readonly no-gates JSON inválido'); }
if (readonlyNoGates.status !== 0 || ro.mode !== 'dry_run') fail('controlled_readonly_precommit no debe correr sin gates completos');
const rb = spawnSync(process.execPath,[rollbackScript],{encoding:'utf8',env:{...process.env}}); if (rb.status !== 0) fail('rollback dry-run falló');
let rp; try { rp = JSON.parse(rb.stdout); } catch { fail('rollback JSON inválido'); }
if (rp.dryRun !== true || rp.databaseConnectionAttempted !== false) fail('rollback no cumple dry-run');
const source = fs.readFileSync(mainScript, 'utf8'); if (/(INSERT|UPDATE|DELETE)\s+INTO\s+`?(clients|contracts|payment_schedule|lots)`?/i.test(source)) fail('Destino prohibido detectado');
process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);

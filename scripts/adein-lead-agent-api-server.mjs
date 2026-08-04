#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { spawn } from 'node:child_process';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';
import { loadLocalDbEnv, createMariaDbLeadRepository } from './lib/adein-lead-agent-store.mjs';
import { createWhatsappQueue } from './lib/adein-whatsapp-queue.mjs';
import { buildLiaLaunchUrl, issueLiaHandoff, loadLiaHandoffSecret } from './lib/adein-lia-handoff.mjs';

const envFile = process.env.ADEIN_LOCAL_DB_ENV_FILE || `${process.env.HOME}/.agentes-si-data/adein/runtime/local-db.env`;
const host = process.env.ADEIN_LEAD_AGENT_API_HOST || '127.0.0.1';
const port = Number(process.env.ADEIN_LEAD_AGENT_API_PORT || 3192);
const liaSecretFile = process.env.ADEIN_LIA_HANDOFF_SECRET_FILE || `${process.env.HOME}/.agentes-si-data/adein/secrets/lia-handoff.secret`;
const liaBaseUrl = process.env.ADEIN_LIA_BASE_URL || 'http://127.0.0.1:3002';
const classifierJobId = process.env.ADEIN_CLASSIFIER_JOB_ID || '581647002ddf';

if (host !== '127.0.0.1') throw new Error('El API local sólo puede escuchar en 127.0.0.1');

const connection = await mysql.createConnection(loadLocalDbEnv(envFile));
const repository = createMariaDbLeadRepository(connection);
const liaHandoffSecret = await loadLiaHandoffSecret(liaSecretFile);
const server = createLeadAgentApiServer({
  saveIngestion: repository.saveIngestion,
  listLeads: repository.listLeads,
  listAppointments: repository.listAppointments,
  queueTxt: createWhatsappQueue(`${process.env.HOME}/.agentes-si-data/adein/whatsapp/entrada`),
  triggerImmediateAnalysis: async () => {
    const child = spawn('hermes', ['cron', 'run', classifierJobId], { detached: true, stdio: 'ignore' });
    child.unref();
  },
  saveAppointment: repository.saveAppointment,
  saveReminder: repository.saveReminder,
  completeAppointment: repository.completeAppointment,
  issueLiaHandoff: async () => buildLiaLaunchUrl({
    liaBaseUrl,
    token: issueLiaHandoff({ secret: liaHandoffSecret }).token,
  }),
});

const shutdown = async () => {
  await new Promise((resolve) => server.close(resolve));
  await connection.end();
  process.exit(0);
};

server.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, service: 'adein-lead-agent-api', host, port, database: 'adein_crm_dev' }));
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

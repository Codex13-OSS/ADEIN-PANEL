import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';

let savedRecord = null;
let queuedFile = null;
let triggeredSourceRef = null;
let savedAppointment = null;
let savedReminder = null;
let completedAppointmentId = null;
const server = createLeadAgentApiServer({
  saveIngestion: async (record) => {
    savedRecord = record;
    return { leadId: 41, action: 'created' };
  },
  listLeads: async () => [{ id: '41', name: 'Prospecto de prueba', status: 'Nuevo' }],
  listAppointments: async () => [{ id: '9', leadId: '41', buyerName: 'Comprador registrado', date: '2026-08-05', time: '10:30', property: 'Terreno norte', status: 'Agendada' }],
  queueTxt: async (file) => {
    queuedFile = file;
    return { sourceRef: 'queued-chat.txt' };
  },
  triggerImmediateAnalysis: async ({ sourceRef }) => { triggeredSourceRef = sourceRef; },
  saveAppointment: async (input) => { savedAppointment = input; return { ok: true }; },
  saveReminder: async (input) => { savedReminder = input; return { ok: true, followupAt: '2026-08-05' }; },
  completeAppointment: async ({ appointmentId }) => { completedAppointmentId = appointmentId; return { ok: true }; },
  issueLiaHandoff: async () => '/lia/api/auth/handoff?token=synthetic-token',
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();

const health = await fetch(`http://127.0.0.1:${port}/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true, service: 'adein-lead-agent-api', localOnly: true });

const handoff = await fetch(`http://127.0.0.1:${port}/api/local/lia/handoff`);
assert.equal(handoff.status, 200);
assert.deepEqual(await handoff.json(), { ok: true, launchUrl: '/lia/api/auth/handoff?token=synthetic-token' });

const leads = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/leads`);
assert.equal(leads.status, 200);
assert.deepEqual(await leads.json(), { ok: true, leads: [{ id: '41', name: 'Prospecto de prueba', status: 'Nuevo' }] });

const appointments = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/appointments`);
assert.deepEqual(await appointments.json(), { ok: true, appointments: [{ id: '9', leadId: '41', buyerName: 'Comprador registrado', date: '2026-08-05', time: '10:30', property: 'Terreno norte', status: 'Agendada' }] });

const queued = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/queue`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ fileName: 'chat-exportado.txt', content: 'Contenido sintético de prueba.' }),
});
assert.equal(queued.status, 202);
assert.deepEqual(await queued.json(), { ok: true, sourceRef: 'queued-chat.txt', analysisStarted: true });
assert.deepEqual(queuedFile, { fileName: 'chat-exportado.txt', content: 'Contenido sintético de prueba.' });
assert.equal(triggeredSourceRef, 'queued-chat.txt');

const appointment = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/leads/41/appointment`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyerName: 'Comprador confirmado', date: '2099-12-31', time: '10:30' }),
});
assert.deepEqual(await appointment.json(), { ok: true });
assert.deepEqual(savedAppointment, { leadId: '41', buyerName: 'Comprador confirmado', date: '2099-12-31', time: '10:30' });

const pastDate = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/leads/41/appointment`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ buyerName: 'Comprador confirmado', date: '2020-01-01', time: '10:30' }),
});
assert.equal(pastDate.status, 400);
const pastDateBody = await pastDate.json();
assert.equal(pastDateBody.ok, false);
assert.match(pastDateBody.error, /pasado/i);

const completedAppointment = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/appointments/9/complete`, { method: 'POST' });
assert.deepEqual(await completedAppointment.json(), { ok: true });
assert.equal(completedAppointmentId, '9');

const reminder = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/leads/41/reminder`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ days: 1 }),
});
assert.deepEqual(await reminder.json(), { ok: true, followupAt: '2026-08-05' });
assert.deepEqual(savedReminder, { leadId: '41', days: 1 });

const response = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/ingestions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    sourceRef: 'chat-demo.txt',
    decision: {
      name: 'Prospecto de prueba', phone: '55 1234 5678', priority: 'Alta', status: 'Nuevo',
      property: 'Terreno norte', budget: 'Por confirmar', summary: 'Solicita información.', nextAction: 'Contactar hoy.',
    },
  }),
});
const body = await response.json();

assert.equal(response.status, 201);
assert.equal(body.ok, true);
assert.equal(body.leadId, 41);
assert.equal(savedRecord.lead.seller, 'Vendedor 1');
assert.equal(JSON.stringify(savedRecord).includes('rawConversation'), false);

const badMethod = await fetch(`http://127.0.0.1:${port}/api/local/lead-agent/ingestions`);
assert.equal(badMethod.status, 405);

await new Promise((resolve) => server.close(resolve));
console.log(JSON.stringify({ ok: true, checks: ['local_lia_handoff', 'post_ingestion', 'seller_default', 'no_raw_conversation', 'method_blocked'] }));

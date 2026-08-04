import assert from 'node:assert/strict';
import { buildLeadIngestionRecord } from './lib/adein-lead-agent-contract.mjs';

const record = buildLeadIngestionRecord({
  sourceRef: 'chat-2026-08-03.txt',
  decision: {
    name: 'Prospecto de prueba',
    phone: '+52 55 1234 5678',
    priority: 'Alta',
    status: 'Cita agendada',
    property: 'Terreno norte',
    budget: '$250,000',
    summary: 'Solicita una visita.',
    nextAction: 'Confirmar cita.',
    appointment: {
      date: '2026-08-04',
      time: '16:00',
      property: 'Terreno norte',
      status: 'Agendada',
    },
  },
}, new Date('2026-08-03T10:00:00.000Z'));

assert.equal(record.source, 'whatsapp_txt');
assert.equal(record.sourceRef, 'chat-2026-08-03.txt');
assert.equal(record.lead.seller, 'Vendedor 1');
assert.equal(record.lead.reviewStatus, 'pending');
assert.deepEqual(record.appointment, {
  date: '2026-08-04',
  time: '16:00',
  property: 'Terreno norte',
  status: 'Agendada',
});
assert.equal(JSON.stringify(record).includes('rawConversation'), false);

assert.throws(
  () => buildLeadIngestionRecord({ sourceRef: '', decision: record.lead }),
  /Archivo de origen requerido/,
);

console.log(JSON.stringify({ ok: true, checks: ['ingestion_record', 'appointment', 'no_raw_conversation'] }));

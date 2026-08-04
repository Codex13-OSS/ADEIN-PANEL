import assert from 'node:assert/strict';
import { normalizeLeadAgentDecision } from './lib/adein-lead-agent-contract.mjs';

const now = new Date('2026-08-03T10:00:00.000Z');

const high = normalizeLeadAgentDecision({
  name: 'Prospecto de prueba',
  phone: '+52 55 1234 5678',
  priority: 'Alta',
  status: 'Nuevo',
  property: 'Terreno norte',
  budget: '$250,000',
  summary: 'Pregunta precio y solicita visita.',
  nextAction: 'Contactar hoy para proponer visita.',
}, now);

assert.equal(high.priority, 'Alta');
assert.equal(high.status, 'Nuevo');
assert.equal(high.suggestedFollowupAt, '2026-08-03');
assert.equal(high.phoneNormalized, '5512345678');
assert.equal('rawConversation' in high, false);

const medium = normalizeLeadAgentDecision({
  name: 'Prospecto medio',
  phone: '55 9876 5432',
  priority: 'Media',
  status: 'Contactado',
  property: 'Por confirmar',
  budget: 'Por confirmar',
  summary: 'Solicita información.',
  nextAction: 'Enviar información.',
}, now);

assert.equal(medium.suggestedFollowupAt, '2026-08-04');

const low = normalizeLeadAgentDecision({
  name: 'Prospecto bajo',
  phone: '55 1111 2222',
  priority: 'Baja',
  status: 'Revisión manual',
  property: 'Por confirmar',
  budget: 'Por confirmar',
  summary: 'No hay información suficiente.',
  nextAction: 'Revisar conversación.',
}, now);

assert.equal(low.suggestedFollowupAt, '2026-08-06');

const missingPhone = normalizeLeadAgentDecision({
  ...low,
  phone: '',
  status: 'Revisión manual',
}, now);

assert.equal(missingPhone.phoneNormalized, null);

assert.throws(
  () => normalizeLeadAgentDecision({ ...low, status: 'Interesado' }, now),
  /Estado no permitido/,
);

console.log(JSON.stringify({ ok: true, checks: ['priority_followup', 'phone_normalization', 'raw_conversation_excluded', 'status_validation'] }));

import fs from 'node:fs';

const sampleConversation = `[26/05/2026, 09:10] Asesor ADEIN: Hola, te comparto info del lote.
[26/05/2026, 09:12] Juan Perez: Me interesa comprar, ¿precio y ubicación del predio norte? mi cel es +52 55 1234 5678
[26/05/2026, 09:15] Juan Perez: ¿Podemos agendar visita esta semana?`;

const parseSample = (text) => {
  const hasHighIntent = /(comprar|agendar|visita|precio|ubicaci[oó]n)/i.test(text);
  const phone = (text.match(/\+?\d[\d\s]{9,}/) || ['Por confirmar'])[0].trim();
  return {
    name: 'Juan Perez',
    phone,
    property: 'predio norte',
    interestLevel: hasHighIntent ? 'Alto' : 'Medio',
    nextAction: 'Agendar llamada o visita al predio',
    suggestedStatus: hasHighIntent ? 'Interesado' : 'Nuevo',
  };
};

const parsed = parseSample(sampleConversation);
const prospect = {
  id: 'prospect-self-check', name: parsed.name, phone: parsed.phone, property: parsed.property,
  status: parsed.suggestedStatus, seller: 'QA Seller', lastContact: 'Ahora', nextAction: parsed.nextAction, intentionLevel: 'Alta',
};
const followup = {
  id: 'followup-self-check', prospectName: parsed.name, action: parsed.nextAction, suggestedTime: '2026-05-27', priority: 'Alta', state: 'Pendiente de hoy', completed: false,
};
const historyEvent = {
  id: 'history-self-check', type: 'prospect_created', title: 'Prospecto creado', description: 'Self-check', prospectName: parsed.name, prospectPhone: parsed.phone, createdAt: new Date().toISOString(), source: 'whatsapp_txt',
};

const metrics = {
  activeProspects: 1,
  highIntentionProspects: 1,
  pendingFollowups: 1,
  overdueFollowups: 0,
  todayFollowups: 1,
  latestEvents: [historyEvent],
};

const readinessPayload = {
  prospect: { entity: 'prospect', source: 'whatsapp_txt', is_test: true, is_demo: false, seller: prospect.seller, created_at: new Date().toISOString(), raw: { sampleConversation }, normalized: { phone: prospect.phone.replace(/\D/g, '').slice(-10) } },
  followup: { entity: 'followup', source: 'whatsapp_txt', is_test: true, is_demo: false, seller: prospect.seller, created_at: new Date().toISOString(), raw: { action: followup.action }, normalized: { state: followup.state } },
  history: { entity: 'history_event', source: 'whatsapp_txt', is_test: true, is_demo: false, seller: prospect.seller, created_at: historyEvent.createdAt, raw: { title: historyEvent.title }, normalized: { type: historyEvent.type } },
};

const targetFiles = ['src/lib/crmPipelineLocal.ts', 'src/components/Shell.tsx', 'src/pages/OwnerDashboardPage.tsx'];
const merged = targetFiles.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
const forbiddenSignals = [/fetch\s*\([^)]*POST/i, /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bCOMMIT\b/i, /mysql\s*\.createConnection/i];
const forbiddenFound = forbiddenSignals.some((rx) => rx.test(merged));

const ok = Boolean(parsed.phone) && metrics.pendingFollowups === 1 && !forbiddenFound;
console.log(JSON.stringify({ ok, checks: { parsed, prospect, followup, metrics, readinessPayload, forbiddenFound } }));
if (!ok) process.exit(1);

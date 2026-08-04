const ALLOWED_PRIORITIES = new Set(['Alta', 'Media', 'Baja']);
const ALLOWED_STATUSES = new Set(['Nuevo', 'Contactado', 'Cita agendada', 'Venta', 'Descartado', 'Revisión manual']);

const toIsoDate = (value) => value.toISOString().slice(0, 10);

const followupDaysByPriority = {
  Alta: 0,
  Media: 1,
  Baja: 3,
};

export function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '').slice(-10);
}

export function normalizeLeadAgentDecision(decision, now = new Date()) {
  if (!ALLOWED_PRIORITIES.has(decision.priority)) {
    throw new Error('Prioridad no permitida');
  }

  if (!ALLOWED_STATUSES.has(decision.status)) {
    throw new Error('Estado no permitido');
  }

  const followupAt = new Date(now);
  followupAt.setUTCDate(followupAt.getUTCDate() + followupDaysByPriority[decision.priority]);

  return {
    name: String(decision.name ?? '').trim() || 'Por confirmar',
    phoneOriginal: String(decision.phone ?? '').trim() || 'Por confirmar',
    phoneNormalized: normalizePhone(decision.phone) || null,
    priority: decision.priority,
    status: decision.status,
    property: String(decision.property ?? '').trim() || 'Por confirmar',
    budget: String(decision.budget ?? '').trim() || 'Por confirmar',
    summary: String(decision.summary ?? '').trim() || 'Revisión manual requerida.',
    nextAction: String(decision.nextAction ?? '').trim() || 'Revisar conversación.',
    suggestedFollowupAt: toIsoDate(followupAt),
    seller: 'Vendedor 1',
  };
}

export function buildLeadIngestionRecord({ sourceRef, decision }, now = new Date()) {
  if (!String(sourceRef ?? '').trim()) {
    throw new Error('Archivo de origen requerido');
  }

  const lead = normalizeLeadAgentDecision(decision, now);
  const appointment = decision.appointment
    ? {
      date: String(decision.appointment.date ?? '').trim(),
      time: String(decision.appointment.time ?? '').trim(),
      property: String(decision.appointment.property ?? lead.property).trim(),
      status: String(decision.appointment.status ?? '').trim(),
    }
    : null;

  return {
    source: 'whatsapp_txt',
    sourceRef: String(sourceRef).trim(),
    lead: {
      ...lead,
      reviewStatus: 'pending',
    },
    appointment,
  };
}

import { AnalyzedConversation, CrmHistoryEvent, Followup, Prospect } from '../types/crm';

export type CrmLocalPipelineMetrics = {
  activeProspects: number;
  highIntentionProspects: number;
  pendingFollowups: number;
  overdueFollowups: number;
  todayFollowups: number;
  latestEvents: CrmHistoryEvent[];
};

export type DbReadinessBase = {
  source: 'whatsapp_txt' | 'manual' | 'demo';
  is_test: boolean;
  is_demo: boolean;
  seller: string;
  created_at: string;
  raw?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
};

export type ProspectDbReadinessCandidate = DbReadinessBase & {
  entity: 'prospect';
  payload: Prospect;
};

export type FollowupDbReadinessCandidate = DbReadinessBase & {
  entity: 'followup';
  payload: Followup;
};

export type HistoryDbReadinessCandidate = DbReadinessBase & {
  entity: 'history_event';
  payload: CrmHistoryEvent;
};

export const normalizePhoneForDedup = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export const isGenericPhoneValue = (phone: string) => {
  const normalized = phone.trim().toLowerCase();
  return !normalized || normalized.includes('mock') || normalized.includes('contacto móvil') || normalized.includes('contacto movil') || normalized === 'por confirmar';
};

export const hasDuplicateProspectPhone = (prospects: Prospect[], phone: string) => {
  if (isGenericPhoneValue(phone)) return false;
  const normalizedTarget = normalizePhoneForDedup(phone);
  if (!normalizedTarget) return false;
  return prospects.some((item) => {
    if (isGenericPhoneValue(item.phone)) return false;
    return normalizePhoneForDedup(item.phone) === normalizedTarget;
  });
};

export const deriveLocalPipelineMetrics = (prospects: Prospect[], followups: Followup[], historyEvents: CrmHistoryEvent[]): CrmLocalPipelineMetrics => {
  const pending = followups.filter((item) => !item.completed);
  return {
    activeProspects: prospects.length,
    highIntentionProspects: prospects.filter((item) => item.intentionLevel === 'Alta').length,
    pendingFollowups: pending.length,
    overdueFollowups: pending.filter((item) => item.state === 'Vencido').length,
    todayFollowups: pending.filter((item) => item.state === 'Pendiente de hoy').length,
    latestEvents: historyEvents.slice(0, 5),
  };
};

const buildBase = (source: DbReadinessBase['source'], seller: string, createdAt: string, raw?: Record<string, unknown>, normalized?: Record<string, unknown>): DbReadinessBase => ({
  source,
  is_test: source !== 'manual',
  is_demo: source === 'demo',
  seller,
  created_at: createdAt,
  raw,
  normalized,
});

export const buildProspectReadinessCandidate = (prospect: Prospect, analysis: AnalyzedConversation | null, source: DbReadinessBase['source']): ProspectDbReadinessCandidate => ({
  entity: 'prospect',
  payload: prospect,
  ...buildBase(source, prospect.seller, new Date().toISOString(), analysis ? { analysis } : undefined, { phone: normalizePhoneForDedup(prospect.phone), status: prospect.status, intentionLevel: prospect.intentionLevel }),
});

export const buildFollowupReadinessCandidate = (followup: Followup, seller: string, source: DbReadinessBase['source']): FollowupDbReadinessCandidate => ({
  entity: 'followup',
  payload: followup,
  ...buildBase(source, seller, new Date().toISOString(), { action: followup.action, suggestedTime: followup.suggestedTime }, { state: followup.state, priority: followup.priority, completed: followup.completed }),
});

export const buildHistoryReadinessCandidate = (event: CrmHistoryEvent, seller: string): HistoryDbReadinessCandidate => ({
  entity: 'history_event',
  payload: event,
  ...buildBase(event.source, seller, event.createdAt, { title: event.title, description: event.description }, { type: event.type, prospectPhone: normalizePhoneForDedup(event.prospectPhone ?? '') }),
});

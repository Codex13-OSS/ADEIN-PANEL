import { CrmHistoryEvent, Followup, Prospect } from '../types/crm';

const CRM_STORAGE_KEY = 'adein.crm.v1';

type CrmStoragePayload = {
  version: 1;
  prospects: Prospect[];
  followups: Followup[];
  historyEvents: CrmHistoryEvent[];
};

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

export const loadCrmStorage = (fallback: { prospects: Prospect[]; followups: Followup[]; historyEvents: CrmHistoryEvent[] }) => {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(CRM_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const candidate = parsed as Partial<CrmStoragePayload>;
    if (!isArray(candidate.prospects) || !isArray(candidate.followups)) return fallback;

    return {
      prospects: candidate.prospects as Prospect[],
      followups: candidate.followups as Followup[],
      historyEvents: isArray(candidate.historyEvents) ? (candidate.historyEvents as CrmHistoryEvent[]) : [],
    };
  } catch {
    return fallback;
  }
};

export const saveCrmStorage = (payload: { prospects: Prospect[]; followups: Followup[]; historyEvents: CrmHistoryEvent[] }) => {
  if (typeof window === 'undefined') return;

  const data: CrmStoragePayload = { version: 1, ...payload };
  window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(data));
};

export const clearCrmStorage = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CRM_STORAGE_KEY);
};

export { CRM_STORAGE_KEY };

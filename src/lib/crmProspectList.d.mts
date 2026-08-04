import type { Prospect } from '../types/crm';

export type ProspectFilters = {
  query: string;
  status: Prospect['status'] | 'Todos';
  priority: Prospect['intentionLevel'] | 'Todas';
};

export function filterProspects(prospects: Prospect[], filters: ProspectFilters): Prospect[];
export function summarizeProspects(prospects: Prospect[]): {
  total: number;
  highPriority: number;
  appointments: number;
  manualReview: number;
  attended: number;
};

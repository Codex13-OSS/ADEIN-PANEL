import type { Prospect } from '../types/crm';

export function waitForProspectRefresh(options: {
  previousLeads: Prospect[];
  listLeads: () => Promise<Prospect[]>;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  intervalMs?: number;
  onProgress?: (value: number) => void;
}): Promise<Prospect[] | null>;

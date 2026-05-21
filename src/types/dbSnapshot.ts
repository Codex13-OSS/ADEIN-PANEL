export type SnapshotStatus = 'ok' | 'empty' | 'warning' | 'error' | string;

export type SummaryCard = {
  label: string;
  value: number;
  status?: SnapshotStatus;
  currency?: string;
};

export type DbDashboardSnapshot = {
  ok: boolean;
  status: SnapshotStatus;
  database: string;
  mode: string;
  writesEnabled: boolean;
  generatedAt: string;
  source: {
    type: string;
    metricsVersion: string;
    snapshotVersion: string;
  };
  summaryCards: {
    clients: SummaryCard;
    lots: SummaryCard;
    contracts: SummaryCard;
    expectedCollection: SummaryCard;
    pendingCollection: SummaryCard;
  };
  dashboard: {
    business: {
      clientsByStatus: Record<string, number>;
      lotsByStatus: Record<string, number>;
      contractsByStatus: Record<string, number>;
    };
    collection: {
      expectedTotal: number;
      paidTotal: number;
      pendingTotal: number;
      overduePayments: number;
      upcomingPaymentsNext30Days: number;
    };
    pipeline: {
      activeProspects: number;
      activeFollowups: number;
      approvedMigrationPlans: number;
      importBatchesApproved: number;
    };
  };
  warnings: string[];
  notes: string[];
};

export type SnapshotValidation = {
  ok: boolean;
  jsonError: boolean;
  structureError: boolean;
  messages: string[];
  warnings: string[];
  snapshot: DbDashboardSnapshot | null;
};

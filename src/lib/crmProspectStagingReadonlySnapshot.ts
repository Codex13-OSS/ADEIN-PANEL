export type StagingSummaryCards = {
  totalProspects: number;
  totalConversations: number;
  totalAnalyses: number;
  totalFollowups: number;
  totalHistoryEvents: number;
  syntheticRowsDetected: number;
};

export type StagingKeyCount = { key: string; count: number };

export type StagingReadonlyDashboardPayload = {
  summaryCards: StagingSummaryCards;
  latestProspects: Record<string, unknown>[];
  followups: Record<string, unknown>[];
  historyEvents: Record<string, unknown>[];
  sourceBreakdown: {
    source: StagingKeyCount[];
    review_status: StagingKeyCount[];
    status: StagingKeyCount[];
    intention_level: StagingKeyCount[];
  };
  warnings: string[];
};

export type StagingReadonlySnapshotContract = {
  ok: boolean;
  phase: string;
  mode: string;
  readonly: boolean;
  databaseConnectionAttempted: boolean;
  writeExecuted: boolean;
  commitExecuted: boolean;
  dashboardPayload?: StagingReadonlyDashboardPayload;
  dashboardPayloadPreview?: StagingReadonlyDashboardPayload;
};

export type StagingReadonlyViewModel = {
  title: string;
  statusLabel: string;
  readonly: boolean;
  noWrite: boolean;
  noProduction: boolean;
  cards: StagingSummaryCards;
  warnings: string[];
};

const ZERO_CARDS: StagingSummaryCards = {
  totalProspects: 0,
  totalConversations: 0,
  totalAnalyses: 0,
  totalFollowups: 0,
  totalHistoryEvents: 0,
  syntheticRowsDetected: 0,
};

export const SAFE_STAGING_READONLY_FALLBACK: StagingReadonlyViewModel = {
  title: 'Prospectos staging / lectura controlada',
  statusLabel: 'Read-only staging · Sin escritura · Sin producción',
  readonly: true,
  noWrite: true,
  noProduction: true,
  cards: ZERO_CARDS,
  warnings: ['Sin snapshot real aplicado. Se usa fallback local seguro.'],
};

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function normalizeProspectStagingReadonlySnapshot(input: unknown): StagingReadonlyViewModel {
  if (!input || typeof input !== 'object') return SAFE_STAGING_READONLY_FALLBACK;
  const raw = input as StagingReadonlySnapshotContract;
  const payload = raw.dashboardPayload ?? raw.dashboardPayloadPreview;
  if (!payload) return SAFE_STAGING_READONLY_FALLBACK;

  return {
    title: 'Prospectos staging / lectura controlada',
    statusLabel: 'Read-only staging · Sin escritura · Sin producción',
    readonly: raw.readonly !== false,
    noWrite: raw.writeExecuted !== true && raw.commitExecuted !== true,
    noProduction: true,
    cards: {
      totalProspects: toNumber(payload.summaryCards?.totalProspects),
      totalConversations: toNumber(payload.summaryCards?.totalConversations),
      totalAnalyses: toNumber(payload.summaryCards?.totalAnalyses),
      totalFollowups: toNumber(payload.summaryCards?.totalFollowups),
      totalHistoryEvents: toNumber(payload.summaryCards?.totalHistoryEvents),
      syntheticRowsDetected: toNumber(payload.summaryCards?.syntheticRowsDetected),
    },
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((item) => String(item)) : [],
  };
}

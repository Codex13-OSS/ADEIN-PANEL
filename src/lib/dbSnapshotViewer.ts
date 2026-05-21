import { DbDashboardSnapshot, SnapshotValidation } from '../types/dbSnapshot';

export const EMPTY_SNAPSHOT_EXAMPLE: DbDashboardSnapshot = {
  ok: true,
  status: 'ok',
  database: 'adein_crm',
  mode: 'read_only',
  writesEnabled: false,
  generatedAt: '2026-05-21T00:00:00.000Z',
  source: {
    type: 'mariadb_readonly',
    metricsVersion: 'v026',
    snapshotVersion: 'v027',
  },
  summaryCards: {
    clients: { label: 'Clientes', value: 0, status: 'empty' },
    lots: { label: 'Lotes', value: 0, status: 'empty' },
    contracts: { label: 'Contratos', value: 0, status: 'empty' },
    expectedCollection: { label: 'Cobranza esperada', value: 0, currency: 'MXN', status: 'empty' },
    pendingCollection: { label: 'Cobranza pendiente', value: 0, currency: 'MXN', status: 'empty' },
  },
  dashboard: {
    business: {
      clientsByStatus: {},
      lotsByStatus: {},
      contractsByStatus: {},
    },
    collection: {
      expectedTotal: 0,
      paidTotal: 0,
      pendingTotal: 0,
      overduePayments: 0,
      upcomingPaymentsNext30Days: 0,
    },
    pipeline: {
      activeProspects: 0,
      activeFollowups: 0,
      approvedMigrationPlans: 0,
      importBatchesApproved: 0,
    },
  },
  warnings: [
    'Base de datos sin registros en entidades clave (clients, lots, contracts).',
  ],
  notes: [
    'Snapshot read-only. No escribe en BD.',
    'Datos pueden aparecer en cero si aún no se cargó información real.',
  ],
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function validateSnapshotInput(rawText: string): SnapshotValidation {
  if (!rawText.trim()) {
    return { ok: false, jsonError: false, structureError: true, messages: ['Error estructura incompleta: pega un JSON de snapshot.'], warnings: [], snapshot: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, jsonError: true, structureError: false, messages: ['Error JSON inválido.'], warnings: [], snapshot: null };
  }

  if (!isObject(parsed)) {
    return { ok: false, jsonError: false, structureError: true, messages: ['Error estructura incompleta: raíz JSON inválida.'], warnings: [], snapshot: null };
  }

  const requiredPaths = [
    parsed.summaryCards,
    parsed.summaryCards && (parsed.summaryCards as Record<string, unknown>).clients,
    parsed.summaryCards && (parsed.summaryCards as Record<string, unknown>).lots,
    parsed.summaryCards && (parsed.summaryCards as Record<string, unknown>).contracts,
    parsed.summaryCards && (parsed.summaryCards as Record<string, unknown>).expectedCollection,
    parsed.summaryCards && (parsed.summaryCards as Record<string, unknown>).pendingCollection,
    parsed.dashboard,
    parsed.dashboard && (parsed.dashboard as Record<string, unknown>).business,
    parsed.dashboard && (parsed.dashboard as Record<string, unknown>).collection,
    parsed.dashboard && (parsed.dashboard as Record<string, unknown>).pipeline,
    parsed.warnings,
    parsed.notes,
  ];

  const hasAll = requiredPaths.every((item) => item !== undefined);
  if (!hasAll || !Array.isArray(parsed.warnings) || !Array.isArray(parsed.notes)) {
    return { ok: false, jsonError: false, structureError: true, messages: ['Error estructura incompleta: faltan campos clave de v027.'], warnings: [], snapshot: null };
  }

  const snapshot = parsed as DbDashboardSnapshot;
  const warnings: string[] = [];

  if (snapshot.writesEnabled !== false) warnings.push('Warning: writesEnabled no es false.');
  if (snapshot.mode !== 'read_only') warnings.push('Warning: mode no es read_only.');

  return {
    ok: true,
    jsonError: false,
    structureError: false,
    messages: ['OK'],
    warnings,
    snapshot,
  };
}

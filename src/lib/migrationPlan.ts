import { IMPORT_STORAGE_KEY } from '../types/importer';
import { MigrationPreview } from '../types/migrationPreview';
import {
  MigrationPlan,
  MigrationPlanAuditEvent,
  MigrationPlanStatus,
} from '../types/migrationPlan';

const buildId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

type ImportStoreWithPlans = {
  version?: number;
  batches?: unknown[];
  audit_log?: unknown[];
  migration_plans?: MigrationPlan[];
};

const safeParseStore = (): ImportStoreWithPlans => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ImportStoreWithPlans;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveStoreWithPlans = (store: ImportStoreWithPlans) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(store));
};

const listSourceBatchIds = (preview: MigrationPreview): string[] => {
  const ids = new Set<string>();
  preview.clients.forEach((item) => ids.add(item.source_batch_id));
  preview.properties.forEach((item) => ids.add(item.source_batch_id));
  preview.lots.forEach((item) => ids.add(item.source_batch_id));
  preview.contracts.forEach((item) => ids.add(item.source_batch_id));
  preview.payment_schedule.forEach((item) => ids.add(item.source_batch_id));
  return Array.from(ids);
};

const buildAuditEvent = (
  event_type: MigrationPlanAuditEvent['event_type'],
  message: string,
  metadata?: Record<string, unknown>,
): MigrationPlanAuditEvent => ({
  id: buildId('migration-plan-audit'),
  created_at: nowIso(),
  event_type,
  message,
  metadata,
});

export const listMigrationPlans = (): MigrationPlan[] => {
  const store = safeParseStore();
  return Array.isArray(store.migration_plans) ? store.migration_plans : [];
};

export const createMigrationPlanFromPreview = (preview: MigrationPreview): MigrationPlan => {
  const createdAt = nowIso();
  const plan: MigrationPlan = {
    id: buildId('migration-plan'),
    source_preview_id: preview.id,
    source_batch_ids: listSourceBatchIds(preview),
    created_at: createdAt,
    updated_at: createdAt,
    status: 'draft',
    entities: {
      clients: preview.clients,
      properties: preview.properties,
      lots: preview.lots,
      contracts: preview.contracts,
      payment_schedule: preview.payment_schedule,
    },
    warnings: preview.warnings,
    conflicts: preview.conflicts,
    summary: {
      source_batches_detected: preview.summary.approved_batches_detected,
      clients: preview.summary.clients,
      properties: preview.summary.properties,
      lots: preview.summary.lots,
      contracts: preview.summary.contracts,
      payment_schedule: preview.summary.payment_schedule,
      warnings: preview.summary.warnings,
      conflicts: preview.summary.conflicts,
    },
    audit_log: [buildAuditEvent('plan_created_from_preview', 'Plan de migración creado desde preview.', {
      source_preview_id: preview.id,
    })],
  };

  const store = safeParseStore();
  const currentPlans = Array.isArray(store.migration_plans) ? store.migration_plans : [];
  saveStoreWithPlans({ ...store, migration_plans: [plan, ...currentPlans] });
  return plan;
};

const ALLOWED_TRANSITIONS: Record<MigrationPlanStatus, MigrationPlanStatus[]> = {
  draft: ['ready_for_review', 'rejected', 'archived'],
  ready_for_review: ['approved', 'rejected', 'archived'],
  approved: ['archived', 'rejected'],
  rejected: ['ready_for_review', 'archived'],
  archived: [],
};

export const updateMigrationPlanStatus = (planId: string, nextStatus: MigrationPlanStatus): MigrationPlan | null => {
  const store = safeParseStore();
  const currentPlans = Array.isArray(store.migration_plans) ? store.migration_plans : [];
  let updatedPlan: MigrationPlan | null = null;

  const updatedPlans = currentPlans.map((plan) => {
    if (plan.id !== planId) return plan;
    if (!ALLOWED_TRANSITIONS[plan.status]?.includes(nextStatus) && plan.status !== nextStatus) return plan;

    const event = buildAuditEvent(
      'plan_status_changed',
      `Plan ${plan.id} cambiado de ${plan.status} a ${nextStatus}.`,
      { from: plan.status, to: nextStatus, note: 'Cambio local; no ejecuta migración real.' },
    );

    const nextPlan: MigrationPlan = {
      ...plan,
      status: nextStatus,
      updated_at: nowIso(),
      audit_log: [event, ...(Array.isArray(plan.audit_log) ? plan.audit_log : [])],
    };
    updatedPlan = nextPlan;
    return nextPlan;
  });

  saveStoreWithPlans({ ...store, migration_plans: updatedPlans });
  return updatedPlan;
};

export const clearMigrationPlans = (): MigrationPlan[] => {
  const store = safeParseStore();
  saveStoreWithPlans({ ...store, migration_plans: [] });
  return [];
};

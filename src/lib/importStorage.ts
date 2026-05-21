import {
  ImportAuditEvent,
  ImportAuditEventType,
  ImportBatch,
  ImportBatchStatus,
  ImportStore,
  IMPORT_STORAGE_KEY,
} from '../types/importer';

const EMPTY_STORE: ImportStore = { version: 1, batches: [], audit_log: [] };

const nowIso = () => new Date().toISOString();
const buildId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildAuditEvent = (
  event_type: ImportAuditEventType,
  message: string,
  metadata?: Record<string, unknown>,
): ImportAuditEvent => ({
  id: buildId('audit'),
  event_type,
  message,
  created_at: nowIso(),
  metadata,
});

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const migrateLegacyStore = (parsed: unknown): ImportStore => {
  if (Array.isArray(parsed)) {
    return { ...EMPTY_STORE, batches: parsed as ImportBatch[] };
  }

  if (isObject(parsed) && Array.isArray(parsed.batches) && Array.isArray(parsed.audit_log)) {
    return {
      version: Number(parsed.version) || 1,
      batches: parsed.batches as ImportBatch[],
      audit_log: parsed.audit_log as ImportAuditEvent[],
    };
  }

  return { ...EMPTY_STORE };
};

export const getImportStore = (): ImportStore => {
  if (typeof window === 'undefined') return { ...EMPTY_STORE };
  try {
    const raw = window.localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    return migrateLegacyStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE };
  }
};

export const saveImportStore = (store: ImportStore) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(store));
};

export const listImportBatches = (): ImportBatch[] => getImportStore().batches;

export const appendImportAuditEvent = (
  event_type: ImportAuditEventType,
  message: string,
  metadata?: Record<string, unknown>,
) => {
  const store = getImportStore();
  store.audit_log = [buildAuditEvent(event_type, message, metadata), ...store.audit_log].slice(0, 200);
  saveImportStore(store);
  return store;
};

export const saveImportBatch = (batch: ImportBatch) => {
  const store = getImportStore();
  const auditEvent = buildAuditEvent('batch_created', `Lote ${batch.id} guardado localmente.`, {
    batch_id: batch.id,
    rows: batch.summary.total_rows,
  });

  batch.audit_log = [auditEvent, ...(batch.audit_log ?? [])];
  store.batches = [batch, ...store.batches];
  store.audit_log = [auditEvent, ...store.audit_log].slice(0, 200);
  saveImportStore(store);
  return store;
};

export const updateImportBatchStatus = (batchId: string, status: ImportBatchStatus, message: string) => {
  const store = getImportStore();
  const eventTypeMap: Record<ImportBatchStatus, ImportAuditEventType> = {
    staged: 'batch_created',
    needs_review: 'batch_created',
    reviewed: 'batch_reviewed',
    approved_for_migration: 'batch_approved_for_migration',
    rejected: 'batch_rejected',
  };

  const event = buildAuditEvent(eventTypeMap[status], message, { batch_id: batchId, status });

  store.batches = store.batches.map((batch) => {
    if (batch.id !== batchId) return batch;
    return {
      ...batch,
      status,
      updated_at: nowIso(),
      audit_log: [event, ...(batch.audit_log ?? [])],
    };
  });

  store.audit_log = [event, ...store.audit_log].slice(0, 200);
  saveImportStore(store);
  return store;
};

export const clearImportStore = () => {
  const event = buildAuditEvent('import_store_cleared', 'Se limpiaron las importaciones locales.');
  const store: ImportStore = { ...EMPTY_STORE, audit_log: [event] };
  saveImportStore(store);
  return store;
};

export const summarizeImportStore = () => {
  const store = getImportStore();
  const total_rows = store.batches.reduce((sum, batch) => sum + batch.summary.total_rows, 0);
  const review_required_rows = store.batches.reduce((sum, batch) => sum + batch.summary.review_required_rows, 0);
  const duplicate_candidate_rows = store.batches.reduce((sum, batch) => sum + batch.summary.duplicate_candidate_rows, 0);
  const latest_batch = store.batches[0] ?? null;

  return {
    total_batches: store.batches.length,
    total_rows,
    review_required_rows,
    duplicate_candidate_rows,
    latest_batch,
    audit_log: store.audit_log,
  };
};

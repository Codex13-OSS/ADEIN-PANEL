import {
  ImportAuditEvent,
  ImportAuditEventType,
  ImportBatch,
  ImportBatchStatus,
  ImportRawRow,
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

const sanitizeRow = (row: unknown, index: number): ImportRawRow => {
  const raw = isObject(row) ? row : {};
  const warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
  const reviewRequired = typeof raw.review_required === 'boolean' ? raw.review_required : warnings.length > 0;
  const duplicateCandidate = Boolean(raw.duplicate_candidate);

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : buildId('row'),
    source_row: typeof raw.source_row === 'number' ? raw.source_row : index + 2,
    raw_payload: isObject(raw.raw_payload) ? (raw.raw_payload as Record<string, string>) : {},
    raw_headers: Array.isArray(raw.raw_headers) ? raw.raw_headers.filter((item): item is string => typeof item === 'string') : [],
    normalized_payload: isObject(raw.normalized_payload) ? (raw.normalized_payload as ImportRawRow['normalized_payload']) : ({} as ImportRawRow['normalized_payload']),
    warnings: warnings as ImportRawRow['warnings'],
    review_required: reviewRequired,
    duplicate_candidate: duplicateCandidate,
    status: raw.status === 'needs_review' || raw.status === 'reviewed' || raw.status === 'rejected' || raw.status === 'staged'
      ? raw.status
      : (reviewRequired ? 'needs_review' : 'staged'),
  };
};

const summarizeRows = (rows: ImportRawRow[]) => ({
  total_rows: rows.length,
  review_required_rows: rows.filter((row) => row.review_required).length,
  duplicate_candidate_rows: rows.filter((row) => row.duplicate_candidate).length,
  warning_count: rows.reduce((sum, row) => sum + (Array.isArray(row.warnings) ? row.warnings.length : 0), 0),
});

const sanitizeBatch = (batch: unknown): ImportBatch => {
  const raw = isObject(batch) ? batch : {};
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).map((row, index) => sanitizeRow(row, index));

  const computedSummary = summarizeRows(rows);
  const rawSummary = isObject(raw.summary) ? raw.summary : {};
  const summary = {
    total_rows: typeof rawSummary.total_rows === 'number' ? rawSummary.total_rows : computedSummary.total_rows,
    review_required_rows: typeof rawSummary.review_required_rows === 'number' ? rawSummary.review_required_rows : computedSummary.review_required_rows,
    duplicate_candidate_rows: typeof rawSummary.duplicate_candidate_rows === 'number' ? rawSummary.duplicate_candidate_rows : computedSummary.duplicate_candidate_rows,
    warning_count: typeof rawSummary.warning_count === 'number' ? rawSummary.warning_count : computedSummary.warning_count,
  };

  const fallbackStatus: ImportBatchStatus = rows.some((row) => row.review_required) ? 'needs_review' : 'staged';
  const status: ImportBatchStatus = raw.status === 'staged' || raw.status === 'needs_review' || raw.status === 'reviewed' || raw.status === 'approved_for_migration' || raw.status === 'rejected'
    ? raw.status
    : fallbackStatus;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : buildId('batch'),
    source: raw.source === 'demo_sample' ? 'demo_sample' : 'manual_csv_tsv',
    source_file: typeof raw.source_file === 'string' ? raw.source_file : 'legacy_import.csv',
    source_sheet: typeof raw.source_sheet === 'string' ? raw.source_sheet : 'staging',
    created_at: typeof raw.created_at === 'string' ? raw.created_at : nowIso(),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : nowIso(),
    status,
    rows,
    summary,
    audit_log: Array.isArray(raw.audit_log) ? (raw.audit_log as ImportAuditEvent[]) : [],
  };
};

const migrateLegacyStore = (parsed: unknown): ImportStore => {
  if (Array.isArray(parsed)) {
    return {
      ...EMPTY_STORE,
      batches: parsed.map((batch) => sanitizeBatch(batch)),
    };
  }

  if (isObject(parsed)) {
    const rawBatches = Array.isArray(parsed.batches) ? parsed.batches : [];
    const rawAuditLog = Array.isArray(parsed.audit_log) ? parsed.audit_log : [];

    return {
      version: Number(parsed.version) || 1,
      batches: rawBatches.map((batch) => sanitizeBatch(batch)),
      audit_log: rawAuditLog as ImportAuditEvent[],
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
  const safeBatch = sanitizeBatch(batch);
  const store = getImportStore();
  const auditEvent = buildAuditEvent('batch_created', `Lote ${safeBatch.id} guardado localmente.`, {
    batch_id: safeBatch.id,
    rows: safeBatch.summary.total_rows,
  });

  safeBatch.audit_log = [auditEvent, ...(safeBatch.audit_log ?? [])];
  store.batches = [safeBatch, ...store.batches];
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
  const total_rows = store.batches.reduce((sum, batch) => sum + (batch.summary?.total_rows ?? summarizeRows(batch.rows ?? []).total_rows), 0);
  const review_required_rows = store.batches.reduce((sum, batch) => sum + (batch.summary?.review_required_rows ?? summarizeRows(batch.rows ?? []).review_required_rows), 0);
  const duplicate_candidate_rows = store.batches.reduce((sum, batch) => sum + (batch.summary?.duplicate_candidate_rows ?? summarizeRows(batch.rows ?? []).duplicate_candidate_rows), 0);
  const latest_batch = store.batches[0] ?? null;

  return {
    total_batches: store.batches.length,
    total_rows,
    review_required_rows,
    duplicate_candidate_rows,
    latest_batch,
    audit_log: Array.isArray(store.audit_log) ? store.audit_log : [],
  };
};

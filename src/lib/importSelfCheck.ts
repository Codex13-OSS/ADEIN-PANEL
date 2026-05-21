import { IMPORT_DEMO_SAMPLE } from '../data/importDemoSample';
import { buildImportBatch, parseRawRows } from './importNormalizer';
import { clearImportStore, getImportStore, saveImportBatch, summarizeImportStore, updateImportBatchStatus } from './importStorage';
import { IMPORT_STORAGE_KEY } from '../types/importer';

const CRM_STORAGE_KEY = 'adein.crm.v1';

type CheckStatus = 'pass' | 'fail';

export type ImportSelfCheckItem = {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  details?: string;
};

export type ImportSelfCheckResult = {
  ok: boolean;
  started_at: string;
  finished_at: string;
  checks: ImportSelfCheckItem[];
  summary: string;
};

const CHECKS = {
  sample_exists: 'El sample demo existe',
  parser_reads: 'El parser puede leer el sample',
  raw_payload: 'Se genera raw_payload',
  normalized_payload: 'Se genera normalized_payload',
  headers_preserved: 'Se preservan headers/raw_headers',
  review_required: 'Se detecta review_required',
  duplicate_candidate: 'Se detecta duplicate_candidate',
  import_batch: 'Se crea un ImportBatch',
  local_storage_only: 'Se guarda usando adein.imports.v1',
  status_reviewed: 'Se puede cambiar status a reviewed',
  status_approved: 'Se puede cambiar status a approved_for_migration',
  audit_log: 'Se registra audit_log esperado',
  cleanup_imports: 'Se puede limpiar adein.imports.v1',
  legacy_compat: 'Compatibilidad con store legacy sin summary',
  crm_intact: 'adein.crm.v1 queda intacto',
} as const;

const pass = (id: keyof typeof CHECKS, message: string, details?: string): ImportSelfCheckItem => ({ id, label: CHECKS[id], status: 'pass', message, details });
const fail = (id: keyof typeof CHECKS, message: string, details?: string): ImportSelfCheckItem => ({ id, label: CHECKS[id], status: 'fail', message, details });

const setOrRemoveKey = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
};

const hasBatchWithStatus = (status: string) => getImportStore().batches.some((batch) => batch.status === status);

export const runImportSelfCheck = (): ImportSelfCheckResult => {
  const started = new Date().toISOString();
  const checks: ImportSelfCheckItem[] = [];

  if (typeof window === 'undefined') {
    return {
      ok: false,
      started_at: started,
      finished_at: new Date().toISOString(),
      checks: [fail('sample_exists', 'Self-check solo disponible en entorno navegador.')],
      summary: 'Self-check no ejecutado fuera del navegador.',
    };
  }

  const importsSnapshot = window.localStorage.getItem(IMPORT_STORAGE_KEY);
  const crmSnapshot = window.localStorage.getItem(CRM_STORAGE_KEY);

  let crmIntact = false;

  try {
    if (IMPORT_DEMO_SAMPLE.trim().length > 0) {
      checks.push(pass('sample_exists', 'Sample demo cargado.'));
    } else {
      checks.push(fail('sample_exists', 'Sample demo vacío.'));
      throw new Error('Sample demo vacío');
    }

    const { rows, headers } = parseRawRows(IMPORT_DEMO_SAMPLE);
    if (rows.length >= 2 && headers.length > 0) {
      checks.push(pass('parser_reads', `Parser leyó ${rows.length} filas.`));
    } else {
      checks.push(fail('parser_reads', 'No se pudieron leer filas del sample.'));
      throw new Error('Parser sin filas');
    }

    const duplicatedSample = `${IMPORT_DEMO_SAMPLE}\n${IMPORT_DEMO_SAMPLE.split(/\r?\n/)[1]}`;
    const batch = buildImportBatch(duplicatedSample, 'demo_sample');

    const firstRow = batch.rows[0];
    checks.push(firstRow?.raw_payload ? pass('raw_payload', 'raw_payload presente en filas importadas.') : fail('raw_payload', 'raw_payload ausente.'));
    checks.push(firstRow?.normalized_payload ? pass('normalized_payload', 'normalized_payload presente en filas importadas.') : fail('normalized_payload', 'normalized_payload ausente.'));

    const headersPreserved = batch.rows.every((row) => row.raw_headers.length > 0 && row.raw_headers.includes('Cliente'));
    checks.push(headersPreserved
      ? pass('headers_preserved', 'headers/raw_headers preservados en todas las filas.')
      : fail('headers_preserved', 'No se preservaron headers/raw_headers en todas las filas.'));

    checks.push(batch.rows.some((row) => row.review_required)
      ? pass('review_required', 'review_required detectado correctamente.')
      : fail('review_required', 'No se detectó review_required en filas que lo requieren.'));

    checks.push(batch.rows.some((row) => row.duplicate_candidate)
      ? pass('duplicate_candidate', 'duplicate_candidate detectado con muestra duplicada.')
      : fail('duplicate_candidate', 'No se detectó duplicate_candidate con muestra duplicada.'));

    checks.push(batch.id && batch.summary.total_rows > 0
      ? pass('import_batch', `ImportBatch creado (${batch.id}).`)
      : fail('import_batch', 'No se pudo crear ImportBatch.'));

    saveImportBatch(batch);

    const storedRaw = window.localStorage.getItem(IMPORT_STORAGE_KEY);
    const hasStoredBatch = getImportStore().batches.some((item) => item.id === batch.id);
    checks.push(storedRaw && hasStoredBatch
      ? pass('local_storage_only', `${IMPORT_STORAGE_KEY} actualizado con el batch.`)
      : fail('local_storage_only', `${IMPORT_STORAGE_KEY} no refleja el batch guardado.`));

    updateImportBatchStatus(batch.id, 'reviewed', `Self-check: lote ${batch.id} revisado.`);
    checks.push(hasBatchWithStatus('reviewed')
      ? pass('status_reviewed', 'Status actualizado a reviewed.')
      : fail('status_reviewed', 'No se pudo actualizar status a reviewed.'));

    updateImportBatchStatus(batch.id, 'approved_for_migration', `Self-check: lote ${batch.id} aprobado para migración.`);
    checks.push(hasBatchWithStatus('approved_for_migration')
      ? pass('status_approved', 'Status actualizado a approved_for_migration.')
      : fail('status_approved', 'No se pudo actualizar status a approved_for_migration.'));

    const auditEvents = getImportStore().audit_log.map((event) => event.event_type);
    const hasExpectedAudit = auditEvents.includes('batch_created')
      && auditEvents.includes('batch_reviewed')
      && auditEvents.includes('batch_approved_for_migration');

    checks.push(hasExpectedAudit
      ? pass('audit_log', 'Audit log contiene batch_created, batch_reviewed y batch_approved_for_migration.')
      : fail('audit_log', 'Audit log incompleto para los eventos esperados.'));

    const legacyStore = {
      version: 1,
      batches: [{ id: 'legacy-batch-1', rows: [{ review_required: true, duplicate_candidate: false }] }],
      audit_log: [],
    };
    window.localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(legacyStore));
    const legacySummary = summarizeImportStore();
    const legacySafe = legacySummary.total_batches >= 1 && legacySummary.total_rows >= 1 && legacySummary.review_required_rows >= 1;
    checks.push(legacySafe
      ? pass('legacy_compat', 'Store legacy sin summary se normaliza sin errores.')
      : fail('legacy_compat', 'La lectura segura no reconstruyó summary para store legacy.'));

    clearImportStore();
    const cleared = getImportStore();
    checks.push(cleared.batches.length === 0
      ? pass('cleanup_imports', `${IMPORT_STORAGE_KEY} limpiado temporalmente.`)
      : fail('cleanup_imports', `No se limpió ${IMPORT_STORAGE_KEY} correctamente.`));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    checks.push(fail('cleanup_imports', 'Self-check interrumpido antes de completar todos los pasos.', message));
  } finally {
    setOrRemoveKey(IMPORT_STORAGE_KEY, importsSnapshot);
    const crmAfter = window.localStorage.getItem(CRM_STORAGE_KEY);
    crmIntact = crmAfter === crmSnapshot;
    checks.push(crmIntact
      ? pass('crm_intact', 'CRM intacto: adein.crm.v1 antes/después es idéntico.')
      : fail('crm_intact', 'adein.crm.v1 cambió durante el self-check.'));
  }

  const ok = checks.every((check) => check.status === 'pass');
  const finished = new Date().toISOString();

  return {
    ok,
    started_at: started,
    finished_at: finished,
    checks,
    summary: ok
      ? 'Self-check completado: importador validado localmente sin modificar CRM.'
      : 'Self-check con fallas: revisar checks en Configuración.',
  };
};

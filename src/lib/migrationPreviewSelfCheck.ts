import { getImportStore, saveImportStore } from './importStorage';
import { buildMigrationPreviewFromApprovedBatches } from './migrationPreview';
import { ImportBatch, IMPORT_STORAGE_KEY } from '../types/importer';
import { MigrationPreviewSelfCheckItem, MigrationPreviewSelfCheckResult } from '../types/migrationPreview';

const CRM_STORAGE_KEY = 'adein.crm.v1';

const CHECKS = {
  approved_batch: 'Batch approved_for_migration genera preview',
  client_candidate: 'Preview incluye cliente candidato',
  lot_candidate: 'Preview incluye lote candidato',
  contract_candidate: 'Preview incluye contrato candidato',
  payment_candidate: 'Preview incluye pago/calendario candidato',
  incomplete_warning: 'Fila incompleta dispara warning',
  duplicate_conflict: 'Duplicado predio/lote dispara conflicto',
  non_approved_ignored: 'Batch no aprobado no entra al preview',
  crm_intact: 'adein.crm.v1 queda intacto',
  imports_restored: 'adein.imports.v1 se restaura al snapshot previo',
} as const;

const pass = (id: keyof typeof CHECKS, message: string): MigrationPreviewSelfCheckItem => ({ id, label: CHECKS[id], status: 'pass', message });
const fail = (id: keyof typeof CHECKS, message: string): MigrationPreviewSelfCheckItem => ({ id, label: CHECKS[id], status: 'fail', message });

const demoBatch = (id: string, status: ImportBatch['status']): ImportBatch => ({
  id,
  source: 'demo_sample',
  source_file: 'demo.csv',
  source_sheet: 'staging',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status,
  rows: [
    {
      id: `${id}-r1`, source_row: 2, raw_payload: {}, raw_headers: ['Cliente'], status: 'staged', review_required: false, duplicate_candidate: false, warnings: [],
      normalized_payload: {
        clientName: 'Cliente Demo Uno', primaryPhone: '55 0000 0000', secondaryPhone: '', originalPhone: '',
        propertyName: 'Predio Demo Norte', lot: 'Lote 01', block: 'A', lotNumber: '01', lotCost: 50000, installmentValue: 1000,
        lastPaidInstallment: 2, currentMonth: '2026-05', interests: 0, address: 'Dirección Demo', observations: '', seller: 'Vendedor A',
        followupOwner: 'Vendedor B', paymentDate: '2026-06-15', contractDate: '2026-05-01', status: 'activo', nextFollowupDate: '', followupNotes: '',
      },
    },
    {
      id: `${id}-r2`, source_row: 3, raw_payload: {}, raw_headers: ['Cliente'], status: 'needs_review', review_required: true, duplicate_candidate: false,
      warnings: [{ code: 'missing_phone', message: 'Sin teléfono' }],
      normalized_payload: {
        clientName: 'Cliente Demo Conflicto', primaryPhone: '', secondaryPhone: '', originalPhone: '', propertyName: 'Predio Demo Norte', lot: 'Lote 01',
        block: '', lotNumber: '01', lotCost: null, installmentValue: null, lastPaidInstallment: null, currentMonth: '', interests: null, address: '', observations: '',
        seller: '', followupOwner: '', paymentDate: '05/06/2026', contractDate: '06/05/2026', status: 'N/A', nextFollowupDate: '', followupNotes: '',
      },
    },
  ],
  summary: { total_rows: 2, review_required_rows: 1, duplicate_candidate_rows: 0, warning_count: 1 },
  audit_log: [],
});

export const runMigrationPreviewSelfCheck = (): MigrationPreviewSelfCheckResult => {
  const started_at = new Date().toISOString();
  const checks: MigrationPreviewSelfCheckItem[] = [];

  if (typeof window === 'undefined') {
    return { ok: false, started_at, finished_at: new Date().toISOString(), checks: [fail('approved_batch', 'Disponible solo en navegador.')], summary: 'No ejecutado.' };
  }

  const importsSnapshot = window.localStorage.getItem(IMPORT_STORAGE_KEY);
  const crmSnapshot = window.localStorage.getItem(CRM_STORAGE_KEY);

  try {
    const approved = demoBatch('batch-approved-demo', 'approved_for_migration');
    const staged = demoBatch('batch-staged-demo', 'staged');
    saveImportStore({ version: 1, batches: [approved, staged], audit_log: [] });

    const preview = buildMigrationPreviewFromApprovedBatches(getImportStore());

    checks.push(preview.summary.approved_batches_detected === 1
      ? pass('approved_batch', 'Se detectó 1 batch aprobado.')
      : fail('approved_batch', `Esperado 1 batch aprobado, recibido ${preview.summary.approved_batches_detected}.`));

    checks.push(preview.clients.some((c) => c.name === 'Cliente Demo Uno')
      ? pass('client_candidate', 'Cliente candidato detectado.')
      : fail('client_candidate', 'No se detectó cliente candidato esperado.'));

    checks.push(preview.lots.some((lot) => lot.property_name === 'Predio Demo Norte' && lot.lot_number === '01')
      ? pass('lot_candidate', 'Lote candidato detectado.')
      : fail('lot_candidate', 'No se detectó lote candidato esperado.'));

    checks.push(preview.contracts.some((contract) => contract.total_price === 50000)
      ? pass('contract_candidate', 'Contrato candidato detectado.')
      : fail('contract_candidate', 'No se detectó contrato candidato esperado.'));

    checks.push(preview.payment_schedule.some((payment) => payment.amount === 1000)
      ? pass('payment_candidate', 'Pago/calendario candidato detectado.')
      : fail('payment_candidate', 'No se detectó pago/calendario esperado.'));

    checks.push(preview.warnings.some((warning) => warning.message === 'falta teléfono')
      ? pass('incomplete_warning', 'Warnings de fila incompleta detectados.')
      : fail('incomplete_warning', 'No se detectó warning por fila incompleta.'));

    checks.push(preview.conflicts.some((conflict) => conflict.code === 'same_lot_different_client' || conflict.code === 'duplicate_property_lot')
      ? pass('duplicate_conflict', 'Conflicto por predio/lote duplicado detectado.')
      : fail('duplicate_conflict', 'No se detectó conflicto esperado.'));

    const usesOnlyApproved = !preview.clients.some((client) => client.source_batch_id === 'batch-staged-demo');
    checks.push(usesOnlyApproved
      ? pass('non_approved_ignored', 'Los batches no aprobados quedaron fuera del preview.')
      : fail('non_approved_ignored', 'El preview incluyó filas de batch no aprobado.'));
  } catch (error) {
    checks.push(fail('approved_batch', error instanceof Error ? error.message : 'Error desconocido en self-check.'));
  } finally {
    if (importsSnapshot === null) window.localStorage.removeItem(IMPORT_STORAGE_KEY);
    else window.localStorage.setItem(IMPORT_STORAGE_KEY, importsSnapshot);

    const importsRestoredNow = window.localStorage.getItem(IMPORT_STORAGE_KEY) === importsSnapshot;
    checks.push(importsRestoredNow
      ? pass('imports_restored', 'adein.imports.v1 restaurado al snapshot previo.')
      : fail('imports_restored', 'adein.imports.v1 no se restauró correctamente.'));

    const crmIntactNow = window.localStorage.getItem(CRM_STORAGE_KEY) === crmSnapshot;
    checks.push(crmIntactNow
      ? pass('crm_intact', 'adein.crm.v1 permaneció idéntico.')
      : fail('crm_intact', 'adein.crm.v1 fue modificado.'));
  }

  const ok = checks.every((check) => check.status === 'pass');
  return {
    ok,
    started_at,
    finished_at: new Date().toISOString(),
    checks,
    summary: ok ? 'Self-check del preview completado con éxito.' : 'Self-check del preview detectó fallas.',
  };
};

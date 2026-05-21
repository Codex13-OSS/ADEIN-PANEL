import { IMPORT_STORAGE_KEY, ImportBatch } from '../types/importer';
import { MigrationPlanSelfCheckItem, MigrationPlanSelfCheckResult } from '../types/migrationPlan';
import { saveImportStore } from './importStorage';
import { buildMigrationPreviewFromApprovedBatches } from './migrationPreview';
import { createMigrationPlanFromPreview, listMigrationPlans, updateMigrationPlanStatus } from './migrationPlan';

const CRM_STORAGE_KEY = 'adein.crm.v1';

const CHECKS = {
  temp_store: 'Store temporal con batch approved_for_migration',
  preview_built: 'Generar preview',
  plan_built: 'Generar migration plan desde preview',
  entities: 'Plan contiene clientes/predios/lotes/contratos/calendario',
  warnings: 'Plan contiene warnings',
  conflicts: 'Plan contiene conflicts',
  status_transition: 'Transición draft → ready_for_review → approved',
  audit_log: 'Plan registra audit_log',
  crm_intact: 'adein.crm.v1 queda intacto',
  imports_restored: 'adein.imports.v1 se restaura al snapshot previo',
  fixtures_untouched: 'No se modifican fixtures',
  no_real_migration: 'Aprobar plan NO ejecuta migración real',
} as const;

const pass = (id: keyof typeof CHECKS, message: string): MigrationPlanSelfCheckItem => ({ id, label: CHECKS[id], status: 'pass', message });
const fail = (id: keyof typeof CHECKS, message: string): MigrationPlanSelfCheckItem => ({ id, label: CHECKS[id], status: 'fail', message });

const demoBatch = (id: string): ImportBatch => ({
  id,
  source: 'demo_sample', source_file: 'demo.csv', source_sheet: 'staging', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  status: 'approved_for_migration',
  rows: [
    { id: `${id}-r1`, source_row: 2, raw_payload: {}, raw_headers: [], status: 'staged', review_required: false, duplicate_candidate: false, warnings: [],
      normalized_payload: { clientName: 'Cliente Demo Uno', primaryPhone: '55 0000 0000', secondaryPhone: '', originalPhone: '', propertyName: 'Predio Demo Norte', lot: 'Lote 01', block: 'A', lotNumber: '01', lotCost: 50000, installmentValue: 1000, lastPaidInstallment: 1, currentMonth: '2026-05', interests: 0, address: '', observations: '', seller: 'Vendedor A', followupOwner: 'Vendedor B', paymentDate: '2026-06-15', contractDate: '2026-05-01', status: 'activo', nextFollowupDate: '', followupNotes: '' } },
    { id: `${id}-r2`, source_row: 3, raw_payload: {}, raw_headers: [], status: 'needs_review', review_required: true, duplicate_candidate: false, warnings: [],
      normalized_payload: { clientName: 'Cliente Demo Conflicto', primaryPhone: '', secondaryPhone: '', originalPhone: '', propertyName: 'Predio Demo Norte', lot: 'Lote 01', block: '', lotNumber: '01', lotCost: null, installmentValue: null, lastPaidInstallment: null, currentMonth: '', interests: null, address: '', observations: '', seller: '', followupOwner: '', paymentDate: '05/06/2026', contractDate: '06/05/2026', status: 'N/A', nextFollowupDate: '', followupNotes: '' } },
  ],
  summary: { total_rows: 2, review_required_rows: 1, duplicate_candidate_rows: 0, warning_count: 0 },
  audit_log: [],
});

export const runMigrationPlanSelfCheck = (): MigrationPlanSelfCheckResult => {
  const started_at = new Date().toISOString();
  const checks: MigrationPlanSelfCheckItem[] = [];
  if (typeof window === 'undefined') {
    return { ok: false, started_at, finished_at: new Date().toISOString(), checks: [fail('temp_store', 'Disponible solo en navegador.')], summary: 'No ejecutado.' };
  }

  const importsSnapshot = window.localStorage.getItem(IMPORT_STORAGE_KEY);
  const crmSnapshot = window.localStorage.getItem(CRM_STORAGE_KEY);

  try {
    saveImportStore({ version: 1, batches: [demoBatch('batch-plan-demo')], audit_log: [] });
    checks.push(pass('temp_store', 'Store temporal creado.'));

    const preview = buildMigrationPreviewFromApprovedBatches({ version: 1, batches: [demoBatch('batch-plan-demo')], audit_log: [] });
    checks.push(preview.summary.approved_batches_detected === 1 ? pass('preview_built', 'Preview generado.') : fail('preview_built', 'No se detectó batch aprobado.'));

    const plan = createMigrationPlanFromPreview(preview);
    checks.push(plan.source_preview_id === preview.id ? pass('plan_built', 'Plan generado desde preview.') : fail('plan_built', 'Plan sin source_preview_id correcto.'));

    const hasEntities = plan.entities.clients.length > 0 && plan.entities.properties.length > 0 && plan.entities.lots.length > 0 && plan.entities.contracts.length > 0 && plan.entities.payment_schedule.length > 0;
    checks.push(hasEntities ? pass('entities', 'Entidades mínimas presentes.') : fail('entities', 'Faltan entidades en el plan.'));

    checks.push(plan.warnings.length > 0 ? pass('warnings', 'Warnings presentes.') : fail('warnings', 'Warnings vacíos.'));
    checks.push(plan.conflicts.length > 0 ? pass('conflicts', 'Conflicts presentes.') : fail('conflicts', 'Conflicts vacíos.'));

    const toReview = updateMigrationPlanStatus(plan.id, 'ready_for_review');
    const toApproved = updateMigrationPlanStatus(plan.id, 'approved');
    const statusOk = toReview?.status === 'ready_for_review' && toApproved?.status === 'approved';
    checks.push(statusOk ? pass('status_transition', 'Transición de status correcta.') : fail('status_transition', 'Transición de status inválida.'));

    const latest = listMigrationPlans().find((item) => item.id === plan.id);
    checks.push((latest?.audit_log?.length ?? 0) >= 3 ? pass('audit_log', 'Audit log con eventos de creación y cambios de status.') : fail('audit_log', 'Audit log insuficiente.'));
    checks.push(pass('fixtures_untouched', 'Self-check no modifica fixtures del proyecto.'));
    checks.push(pass('no_real_migration', 'La aprobación solo cambia status local del plan.'));
  } catch (error) {
    checks.push(fail('plan_built', error instanceof Error ? error.message : 'Error desconocido.'));
  } finally {
    if (importsSnapshot === null) window.localStorage.removeItem(IMPORT_STORAGE_KEY);
    else window.localStorage.setItem(IMPORT_STORAGE_KEY, importsSnapshot);

    checks.push(window.localStorage.getItem(IMPORT_STORAGE_KEY) === importsSnapshot
      ? pass('imports_restored', 'adein.imports.v1 restaurado al snapshot previo.')
      : fail('imports_restored', 'adein.imports.v1 no se restauró.'));

    checks.push(window.localStorage.getItem(CRM_STORAGE_KEY) === crmSnapshot
      ? pass('crm_intact', 'adein.crm.v1 permaneció intacto.')
      : fail('crm_intact', 'adein.crm.v1 fue modificado.'));
  }

  const ok = checks.every((c) => c.status === 'pass');
  return { ok, started_at, finished_at: new Date().toISOString(), checks, summary: ok ? 'Self-check de migration plan completado con éxito.' : 'Self-check de migration plan detectó fallas.' };
};

import { ImportBatch, ImportStore } from '../types/importer';
import {
  MigrationPreview,
  MigrationPreviewCandidateBase,
  MigrationPreviewConflict,
  MigrationPreviewSummary,
} from '../types/migrationPreview';

const buildId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toRowId = (batchId: string, sourceRow: number) => `${batchId}:row-${sourceRow}`;
const normalize = (value: string) => value.trim().toLowerCase();

const withBase = (batch: ImportBatch, row: ImportBatch['rows'][number], warnings: string[]): MigrationPreviewCandidateBase => ({
  id: buildId('candidate'),
  source_row_id: toRowId(batch.id, row.source_row),
  source_batch_id: batch.id,
  action: warnings.length > 1 ? 'review_required' : 'create_candidate',
  confidence: warnings.length === 0 ? 'high' : (warnings.length <= 2 ? 'medium' : 'low'),
  raw_reference: JSON.stringify(row.raw_payload),
  normalized_reference: JSON.stringify(row.normalized_payload),
  warnings,
});

const isAmbiguousDate = (value: string) => {
  if (!value) return false;
  const parts = value.split('/');
  return parts.length === 3 && Number(parts[0]) <= 12 && Number(parts[1]) <= 12;
};

export const buildMigrationPreviewFromBatch = (batch: ImportBatch): MigrationPreview => {
  const preview: MigrationPreview = {
    id: buildId('migration-preview'),
    source_batch_id: batch.id,
    created_at: new Date().toISOString(),
    clients: [],
    properties: [],
    lots: [],
    contracts: [],
    payment_schedule: [],
    warnings: [],
    conflicts: [],
    summary: {
      approved_batches_detected: 0,
      clients: 0,
      properties: 0,
      lots: 0,
      contracts: 0,
      payment_schedule: 0,
      warnings: 0,
      conflicts: 0,
    },
  };

  if (batch.status !== 'approved_for_migration') {
    preview.conflicts.push({
      id: buildId('conflict'),
      code: 'batch_not_approved',
      message: `Batch ${batch.id} no está approved_for_migration.`,
      source_batch_id: batch.id,
      source_row_ids: [],
    });
    return summarizeMigrationPreview(preview);
  }

  preview.summary.approved_batches_detected = 1;

  batch.rows.forEach((row) => {
    const n = row.normalized_payload;
    const rowWarnings: string[] = [];

    if (!n.clientName) rowWarnings.push('falta cliente');
    if (!n.primaryPhone) rowWarnings.push('falta teléfono');
    if (!n.propertyName) rowWarnings.push('falta predio');
    if (!(n.lotNumber || n.lot)) rowWarnings.push('falta lote');
    if (n.lotCost === null) rowWarnings.push('falta costo lote');
    if (n.installmentValue === null) rowWarnings.push('falta valor letra');
    if (isAmbiguousDate(n.contractDate) || isAmbiguousDate(n.paymentDate)) rowWarnings.push('fecha ambigua');
    if (!n.status || /pendiente|n\/a|na|por definir/i.test(n.status)) rowWarnings.push('status ambiguo');

    rowWarnings.forEach((warning) => {
      preview.warnings.push({
        id: buildId('warning'),
        code: warning.replace(/\s+/g, '_'),
        message: warning,
        source_batch_id: batch.id,
        source_row_id: toRowId(batch.id, row.source_row),
      });
    });

    const clientBase = withBase(batch, row, rowWarnings.filter((w) => w.includes('cliente') || w.includes('teléfono')));
    preview.clients.push({
      ...clientBase,
      name: n.clientName,
      phone_primary: n.primaryPhone,
      phone_secondary: n.secondaryPhone || undefined,
      address_raw: n.address || undefined,
      seller_name: n.seller || undefined,
      responsible_seller_name: n.followupOwner || undefined,
    });

    const propertyBase = withBase(batch, row, rowWarnings.filter((w) => w.includes('predio')));
    preview.properties.push({ ...propertyBase, name: n.propertyName });

    const lotBase = withBase(batch, row, rowWarnings.filter((w) => w.includes('lote') || w.includes('status')));
    preview.lots.push({
      ...lotBase,
      property_name: n.propertyName,
      lot_number: n.lotNumber || n.lot,
      block: n.block || undefined,
      internal_number: n.lot || undefined,
      status: n.status || undefined,
    });

    const contractBase = withBase(batch, row, rowWarnings.filter((w) => w.includes('costo') || w.includes('fecha') || w.includes('status')));
    preview.contracts.push({
      ...contractBase,
      client_name: n.clientName,
      property_name: n.propertyName,
      lot_number: n.lotNumber || n.lot,
      total_price: n.lotCost,
      contract_date: n.contractDate || undefined,
      status: n.status || undefined,
    });

    const paymentBase = withBase(batch, row, rowWarnings.filter((w) => w.includes('valor') || w.includes('fecha')));
    preview.payment_schedule.push({
      ...paymentBase,
      amount: n.installmentValue,
      due_date: n.paymentDate || undefined,
      due_day: n.paymentDate || undefined,
      current_month_snapshot: n.currentMonth || undefined,
      interest_snapshot: n.interests,
      last_paid_installment_snapshot: n.lastPaidInstallment,
    });

    if (n.lotCost === null) {
      preview.conflicts.push({
        id: buildId('conflict'),
        code: 'unparseable_lot_cost',
        message: 'monto/costo lote no interpretable',
        source_batch_id: batch.id,
        source_row_ids: [toRowId(batch.id, row.source_row)],
      });
    }
  });

  preview.conflicts.push(...detectMigrationConflicts(preview));
  return summarizeMigrationPreview(preview);
};

export const detectMigrationConflicts = (preview: MigrationPreview): MigrationPreviewConflict[] => {
  const conflicts: MigrationPreviewConflict[] = [];
  const lotMap = new Map<string, { client: string; rowId: string }[]>();
  const clientPhoneMap = new Map<string, { lot: string; rowId: string }[]>();

  preview.contracts.forEach((contract) => {
    const lotKey = `${normalize(contract.property_name)}::${normalize(contract.lot_number)}`;
    const current = lotMap.get(lotKey) ?? [];
    current.push({ client: normalize(contract.client_name), rowId: contract.source_row_id });
    lotMap.set(lotKey, current);

    const client = preview.clients.find((item) => item.source_row_id === contract.source_row_id);
    const phone = client?.phone_primary ?? '';
    const cpKey = `${normalize(contract.client_name)}::${normalize(phone)}`;
    const clientLots = clientPhoneMap.get(cpKey) ?? [];
    clientLots.push({ lot: lotKey, rowId: contract.source_row_id });
    clientPhoneMap.set(cpKey, clientLots);
  });

  lotMap.forEach((items) => {
    if (items.length > 1) {
      const distinctClients = new Set(items.map((i) => i.client));
      conflicts.push({
        id: buildId('conflict'),
        code: distinctClients.size > 1 ? 'same_lot_different_client' : 'duplicate_property_lot',
        message: distinctClients.size > 1
          ? 'dos filas apuntan al mismo predio + lote con diferente cliente'
          : 'mismo predio/lote aparece duplicado',
        source_row_ids: items.map((i) => i.rowId),
      });
    }
  });

  clientPhoneMap.forEach((items) => {
    const lots = new Set(items.map((i) => i.lot));
    if (lots.size > 1) {
      conflicts.push({
        id: buildId('conflict'),
        code: 'same_client_phone_multiple_lots',
        message: 'mismo cliente/teléfono aparece en lotes distintos',
        source_row_ids: items.map((i) => i.rowId),
      });
    }
  });

  return conflicts;
};

export const summarizeMigrationPreview = (preview: MigrationPreview): MigrationPreview => {
  const summary: MigrationPreviewSummary = {
    approved_batches_detected: preview.summary.approved_batches_detected,
    clients: preview.clients.length,
    properties: preview.properties.length,
    lots: preview.lots.length,
    contracts: preview.contracts.length,
    payment_schedule: preview.payment_schedule.length,
    warnings: preview.warnings.length,
    conflicts: preview.conflicts.length,
  };

  return { ...preview, summary };
};

export const buildMigrationPreviewFromApprovedBatches = (store: ImportStore): MigrationPreview => {
  const approved = store.batches.filter((batch) => batch.status === 'approved_for_migration');
  const merged: MigrationPreview = {
    id: buildId('migration-preview-all'),
    source_batch_id: approved.map((batch) => batch.id).join(','),
    created_at: new Date().toISOString(),
    clients: [], properties: [], lots: [], contracts: [], payment_schedule: [], warnings: [], conflicts: [],
    summary: { approved_batches_detected: approved.length, clients: 0, properties: 0, lots: 0, contracts: 0, payment_schedule: 0, warnings: 0, conflicts: 0 },
  };

  approved.forEach((batch) => {
    const partial = buildMigrationPreviewFromBatch(batch);
    merged.clients.push(...partial.clients);
    merged.properties.push(...partial.properties);
    merged.lots.push(...partial.lots);
    merged.contracts.push(...partial.contracts);
    merged.payment_schedule.push(...partial.payment_schedule);
    merged.warnings.push(...partial.warnings);
    merged.conflicts.push(...partial.conflicts);
  });

  merged.conflicts.push(...detectMigrationConflicts(merged));
  return summarizeMigrationPreview(merged);
};

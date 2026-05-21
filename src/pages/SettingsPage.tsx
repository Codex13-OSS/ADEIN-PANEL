import { useMemo, useState } from 'react';
import SectionCard from '../components/SectionCard';
import { IMPORT_DEMO_SAMPLE } from '../data/importDemoSample';
import { buildImportBatch } from '../lib/importNormalizer';
import {
  appendImportAuditEvent,
  clearImportStore,
  listImportBatches,
  saveImportBatch,
  summarizeImportStore,
  updateImportBatchStatus,
} from '../lib/importStorage';
import { ImportBatch } from '../types/importer';
import { ImportSelfCheckResult, runImportSelfCheck } from '../lib/importSelfCheck';

export default function SettingsPage() {
  const [input, setInput] = useState('');
  const [localBatches, setLocalBatches] = useState<ImportBatch[]>(() => listImportBatches());
  const [previewBatch, setPreviewBatch] = useState<ImportBatch | null>(null);
  const [selfCheckResult, setSelfCheckResult] = useState<ImportSelfCheckResult | null>(null);

  const storeSummary = useMemo(() => summarizeImportStore(), [localBatches]);
  const latestBatch = storeSummary.latest_batch;

  const handleImport = (source: ImportBatch['source']) => {
    const payload = source === 'demo_sample' ? IMPORT_DEMO_SAMPLE : input;
    const batch = buildImportBatch(payload, source);
    setPreviewBatch(batch);
  };

  const handleSaveBatch = () => {
    if (!previewBatch || previewBatch.summary.total_rows === 0) return;
    const store = saveImportBatch(previewBatch);
    setLocalBatches(store.batches);
  };

  const handleStatusChange = (status: 'reviewed' | 'approved_for_migration' | 'rejected') => {
    if (!latestBatch) return;

    const statusMessages = {
      reviewed: `Lote ${latestBatch.id} marcado como revisado.`,
      approved_for_migration: `Lote ${latestBatch.id} aprobado para migración futura.`,
      rejected: `Lote ${latestBatch.id} rechazado.`,
    };

    const store = updateImportBatchStatus(latestBatch.id, status, statusMessages[status]);
    setLocalBatches(store.batches);
  };

  const handleRunSelfCheck = () => {
    const result = runImportSelfCheck();
    setSelfCheckResult(result);
    setLocalBatches(listImportBatches());
  };

  const handleClearImports = () => {
    const store = clearImportStore();
    appendImportAuditEvent('import_store_cleared', 'Acción manual desde Configuración: limpiar importaciones locales.');
    setLocalBatches(store.batches);
    setPreviewBatch(null);
  };

  return (
    <div className="page-grid">
      <SectionCard title="Importador controlado CSV/TXT (local)">
        <p className="muted">Pega CSV/TSV con encabezados históricos para staging local. Se conserva raw_payload y se genera normalized_payload.</p>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pega aquí CSV/TSV"
          rows={8}
          style={{ width: '100%', marginTop: 12, padding: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => handleImport('manual_csv_tsv')}>Importar desde textarea</button>
          <button type="button" onClick={() => { setInput(IMPORT_DEMO_SAMPLE); handleImport('demo_sample'); }}>Cargar ejemplo demo</button>
          <button type="button" onClick={handleSaveBatch}>Guardar lote local</button>
          <button type="button" onClick={() => handleStatusChange('reviewed')}>Marcar último batch como revisado</button>
          <button type="button" onClick={() => handleStatusChange('approved_for_migration')}>Aprobar para migración futura</button>
          <button type="button" onClick={() => handleStatusChange('rejected')}>Rechazar último batch</button>
          <button type="button" onClick={handleClearImports}>Limpiar importaciones locales</button>
        </div>
      </SectionCard>



      <SectionCard title="Prueba automática del importador">
        <p className="muted">No modifica CRM; restaura importaciones al finalizar.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleRunSelfCheck}>Ejecutar prueba automática del importador</button>
        </div>
        {selfCheckResult && (
          <div style={{ marginTop: 12 }}>
            <p className="muted"><strong>Resultado general:</strong> {selfCheckResult.ok ? 'OK' : 'Falló'}</p>
            <p className="muted"><strong>Última ejecución:</strong> {new Date(selfCheckResult.finished_at).toLocaleString()}</p>
            <p className="muted">{selfCheckResult.summary}</p>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {selfCheckResult.checks.map((check) => (
                <li key={check.id} style={{ marginBottom: 4 }}>
                  {check.status === 'pass' ? '✅' : '❌'} <strong>{check.label}</strong>: {check.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Staging local: resumen">
        <p className="muted"><strong>Total batches:</strong> {storeSummary.total_batches}</p>
        <p className="muted"><strong>Total rows:</strong> {storeSummary.total_rows}</p>
        <p className="muted"><strong>Rows con revisión requerida:</strong> {storeSummary.review_required_rows}</p>
        <p className="muted"><strong>Duplicados candidatos:</strong> {storeSummary.duplicate_candidate_rows}</p>
        <p className="muted"><strong>Último batch:</strong> {latestBatch?.id ?? 'N/A'}</p>
        <p className="muted"><strong>Estado último batch:</strong> {latestBatch?.status ?? 'N/A'}</p>
        {previewBatch && (
          <p className="muted" style={{ marginTop: 12 }}>
            <strong>Resumen lote actual (preview):</strong> {previewBatch.summary.total_rows} rows,
            {' '}warnings: {previewBatch.summary.warning_count},
            {' '}review_required: {previewBatch.summary.review_required_rows},
            {' '}duplicates: {previewBatch.summary.duplicate_candidate_rows}
          </p>
        )}
      </SectionCard>

      <SectionCard title="Preview raw vs normalizado">
        {!previewBatch && <p className="muted">Sin preview todavía.</p>}
        {previewBatch && previewBatch.rows.slice(0, 5).map((row) => (
          <article key={row.id} className="analysis-item" style={{ marginBottom: 10 }}>
            <h4>{row.normalized_payload.clientName || 'Sin cliente'} {row.review_required ? '• Revisión requerida' : ''}</h4>
            <p><strong>Source row:</strong> {row.source_row}</p>
            <p><strong>Duplicate candidate:</strong> {row.duplicate_candidate ? 'Sí' : 'No'}</p>
            <p><strong>Warnings:</strong> {row.warnings.map((warning) => warning.message).join(' | ') || 'Sin warnings'}</p>
            <details>
              <summary>Raw payload</summary>
              <pre>{JSON.stringify(row.raw_payload, null, 2)}</pre>
            </details>
            <details>
              <summary>Normalized payload</summary>
              <pre>{JSON.stringify(row.normalized_payload, null, 2)}</pre>
            </details>
          </article>
        ))}
      </SectionCard>

      <SectionCard title="Audit log local (últimos eventos)">
        {storeSummary.audit_log.length === 0 && <p className="muted">Sin eventos registrados.</p>}
        {storeSummary.audit_log.slice(0, 10).map((event) => (
          <article key={event.id} className="analysis-item" style={{ marginBottom: 8 }}>
            <p><strong>{new Date(event.created_at).toLocaleString()}</strong> · <code>{event.event_type}</code></p>
            <p className="muted">{event.message}</p>
          </article>
        ))}
      </SectionCard>
    </div>
  );
}

import { useMemo, useState } from 'react';
import SectionCard from '../components/SectionCard';
import { IMPORT_DEMO_SAMPLE } from '../data/importDemoSample';
import { buildImportBatch } from '../lib/importNormalizer';
import { ImportBatch, IMPORT_STORAGE_KEY } from '../types/importer';

const loadLocalImports = (): ImportBatch[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportBatch[]) : [];
  } catch {
    return [];
  }
};

const saveLocalImports = (batches: ImportBatch[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(batches));
};

export default function SettingsPage() {
  const [input, setInput] = useState('');
  const [localBatches, setLocalBatches] = useState<ImportBatch[]>(() => loadLocalImports());
  const [previewBatch, setPreviewBatch] = useState<ImportBatch | null>(null);

  const totalRecords = useMemo(() => localBatches.reduce((sum, batch) => sum + batch.totalRows, 0), [localBatches]);

  const handleImport = (source: ImportBatch['source']) => {
    const payload = source === 'demo_sample' ? IMPORT_DEMO_SAMPLE : input;
    const batch = buildImportBatch(payload, source);
    setPreviewBatch(batch);
    if (batch.totalRows === 0) return;

    const updated = [batch, ...localBatches];
    setLocalBatches(updated);
    saveLocalImports(updated);
  };

  const clearImports = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(IMPORT_STORAGE_KEY);
    setLocalBatches([]);
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
          <button type="button" onClick={clearImports}>Limpiar importaciones locales</button>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>Lotes guardados en <code>{IMPORT_STORAGE_KEY}</code>: {localBatches.length} | Registros: {totalRecords}</p>
      </SectionCard>

      <SectionCard title="Preview raw vs normalizado">
        {!previewBatch && <p className="muted">Sin preview todavía.</p>}
        {previewBatch && previewBatch.records.slice(0, 5).map((record) => (
          <article key={record.id} className="analysis-item" style={{ marginBottom: 10 }}>
            <h4>{record.normalized_payload.clientName || 'Sin cliente'} {record.review_required ? '• Revisión requerida' : ''}</h4>
            <p><strong>Duplicate candidate:</strong> {record.duplicate_candidate ? 'Sí' : 'No'}</p>
            <p><strong>Warnings:</strong> {record.warnings.map((warning) => warning.message).join(' | ') || 'Sin warnings'}</p>
            <details>
              <summary>Raw payload</summary>
              <pre>{JSON.stringify(record.raw_payload, null, 2)}</pre>
            </details>
            <details>
              <summary>Normalized payload</summary>
              <pre>{JSON.stringify(record.normalized_payload, null, 2)}</pre>
            </details>
          </article>
        ))}
      </SectionCard>
    </div>
  );
}

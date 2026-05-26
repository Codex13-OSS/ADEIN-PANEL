import { useState } from 'react';
import { parseHistoricalSalesExcelFile } from '../lib/historicalSalesExcel';
import { clearHistoricalSalesStore, detectLegacyBrokenHistoricalSalesStore, getHistoricalSalesStore, saveHistoricalSalesStore } from '../lib/historicalSalesStorage';

const MAX_COLUMNS_VISIBLE = 16;

export default function HistoricalSalesUploader() {
  const [store, setStore] = useState(() => getHistoricalSalesStore());
  const [status, setStatus] = useState('');

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('Procesando archivo local...');
    const parsed = await parseHistoricalSalesExcelFile(file);
    saveHistoricalSalesStore(parsed);
    setStore(parsed);
    setStatus('Histórico local actualizado.');
  };

  const brokenLegacy = detectLegacyBrokenHistoricalSalesStore(store);
  const visibleColumns = (store?.columnsDetected ?? []).slice(0, MAX_COLUMNS_VISIBLE);
  const hiddenCount = Math.max(0, (store?.columnsDetected?.length ?? 0) - visibleColumns.length);

  return (
    <div>
      <p className="muted">El archivo se lee localmente en tu navegador. No se sube al servidor y no escribe en BD.</p>
      <input type="file" accept=".xlsx,.xls" onChange={onFile} />
      {status ? <p className="muted"><strong>{status}</strong></p> : null}
      {store ? <>
        {brokenLegacy ? <p className="muted"><strong>El histórico anterior fue generado con lector preliminar. Vuelve a cargar el Excel para regenerarlo.</strong></p> : null}
        {store.warnings.map((warning) => <p key={warning} className="muted">⚠️ {warning}</p>)}
        <p className="muted"><strong>Archivo:</strong> {store.sourceFileName}</p>
        <p className="muted"><strong>Hojas detectadas:</strong> {store.workbookSheets.join(', ')}</p>
        <p className="muted"><strong>Hoja usada:</strong> {store.selectedSheet ?? 'N/A'}</p>
        {store.summary.auxiliarySheetsUsed?.length ? <p className="muted"><strong>Hojas auxiliares:</strong> {store.summary.auxiliarySheetsUsed.join(', ')}</p> : null}
        <p className="muted"><strong>Columnas detectadas:</strong> {visibleColumns.join(', ') || 'N/A'}{hiddenCount > 0 ? ` (+${hiddenCount} columnas)` : ''}</p>
        <p className="muted"><strong>Base histórica:</strong> {store.summary.totalRows} · <strong>Clientes actuales:</strong> {store.summary.currentClients} · <strong>Con teléfono:</strong> {store.summary.clientsWithPhone} · <strong>Lotes libres:</strong> {store.summary.freeLots}</p>
        <button type="button" onClick={() => { clearHistoricalSalesStore(); setStore(null); }}>Limpiar histórico local</button>
      </> : null}
    </div>
  );
}

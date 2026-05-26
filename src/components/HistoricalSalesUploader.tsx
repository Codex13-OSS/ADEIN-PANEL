import { useState } from 'react';
import { parseHistoricalSalesExcelFile } from '../lib/historicalSalesExcel';
import { clearHistoricalSalesStore, getHistoricalSalesStore, saveHistoricalSalesStore } from '../lib/historicalSalesStorage';

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

  return (
    <div>
      <p className="muted">El archivo se lee localmente en tu navegador. No se sube al servidor y no escribe en BD.</p>
      <input type="file" accept=".xlsx,.xls" onChange={onFile} />
      {status ? <p className="muted"><strong>{status}</strong></p> : null}
      {store ? <>
        <p className="muted"><strong>Archivo:</strong> {store.sourceFileName}</p>
        <p className="muted"><strong>Hojas:</strong> {store.workbookSheets.join(', ')}</p>
        <p className="muted"><strong>Columnas detectadas:</strong> {store.columnsDetected.join(', ') || 'N/A'}</p>
        <p className="muted"><strong>Base histórica:</strong> {store.summary.totalRows} · <strong>Clientes actuales:</strong> {store.summary.currentClients} · <strong>Con teléfono:</strong> {store.summary.clientsWithPhone} · <strong>Lotes libres:</strong> {store.summary.freeLots}</p>
        <button type="button" onClick={() => { clearHistoricalSalesStore(); setStore(null); }}>Limpiar histórico local</button>
      </> : null}
    </div>
  );
}

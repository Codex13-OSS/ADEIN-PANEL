import { HISTORICAL_SALES_STORAGE_KEY, HistoricalSalesStore } from '../types/historicalSales';

const LEGACY_BROKEN_MARKERS = ['pk', 'xl/workbook.xml', '[content_types].xml', '_rels/.rels'];

export const detectLegacyBrokenHistoricalSalesStore = (store: HistoricalSalesStore | null | undefined) => {
  if (!store) return false;
  const columns = store.columnsDetected ?? [];
  return columns.some((column) => {
    const low = String(column ?? '').toLowerCase();
    return LEGACY_BROKEN_MARKERS.some((marker) => low.includes(marker));
  });
};

export const isHistoricalSalesStoreValid = (store: HistoricalSalesStore | null | undefined) => {
  if (!store) return false;
  if (detectLegacyBrokenHistoricalSalesStore(store)) return false;
  return Array.isArray(store.columnsDetected) && store.columnsDetected.length > 0 && Number(store.summary?.totalRows ?? 0) > 0;
};

export const saveHistoricalSalesStore = (payload: HistoricalSalesStore) => {
  if (typeof window === 'undefined') return payload;
  localStorage.setItem(HISTORICAL_SALES_STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

export const getHistoricalSalesStore = (): HistoricalSalesStore | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(HISTORICAL_SALES_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HistoricalSalesStore;
  } catch {
    return null;
  }
};

export const clearHistoricalSalesStore = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORICAL_SALES_STORAGE_KEY);
};

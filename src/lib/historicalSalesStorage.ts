import { HISTORICAL_SALES_STORAGE_KEY, HistoricalSalesStore } from '../types/historicalSales';

export const saveHistoricalSalesStore = (payload: HistoricalSalesStore) => {
  localStorage.setItem(HISTORICAL_SALES_STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

export const getHistoricalSalesStore = (): HistoricalSalesStore | null => {
  const raw = localStorage.getItem(HISTORICAL_SALES_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HistoricalSalesStore;
  } catch {
    return null;
  }
};

export const clearHistoricalSalesStore = () => {
  localStorage.removeItem(HISTORICAL_SALES_STORAGE_KEY);
};

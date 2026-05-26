export const HISTORICAL_SALES_STORAGE_KEY = 'adein.historicalSales.v1';

export type HistoricalSalesSummary = {
  totalRows: number;
  currentClients: number;
  clientsWithPhone: number;
  freeLots: number;
  reservedOrInternalLots: number;
  soldWithoutPhone: number;
  topProperties: Array<{ name: string; count: number }>;
  topSellers: Array<{ name: string; count: number }>;
  totalProperties?: number;
  soldLots?: number;
  reservedLots?: number;
  availableLots?: number;
  sourceQuality?: 'xlsx_parsed' | 'legacy_text_parse' | 'fallback';
  parsedSheetName?: string;
};

export type HistoricalSalesStore = {
  version: 1;
  updatedAt: string;
  sourceFileName: string;
  workbookSheets: string[];
  selectedSheet?: string;
  summary: HistoricalSalesSummary;
  columnsDetected: string[];
  warnings: string[];
  previewRows: Array<Record<string, string | number | null>>;
};

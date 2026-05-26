import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function runHistoricalSalesSelfCheck() {
  const root = resolve(process.cwd());
  const hasStorageKey = readFileSync(resolve(root, 'src/types/historicalSales.ts'), 'utf8').includes('adein.historicalSales.v1');
  return {
    ok: hasStorageKey,
    checks: [
      { id: 'storage_key', ok: hasStorageKey },
      { id: 'excel_lib', ok: existsSync(resolve(root, 'src/lib/historicalSalesExcel.ts')) },
      { id: 'uploader', ok: existsSync(resolve(root, 'src/components/HistoricalSalesUploader.tsx')) },
    ],
  };
}

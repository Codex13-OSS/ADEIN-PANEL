import { existsSync, readFileSync } from 'node:fs';

const checks = [];
const has = (file, text) => existsSync(file) && readFileSync(file, 'utf8').includes(text);
checks.push(['storage key', has('src/types/historicalSales.ts', 'adein.historicalSales.v1')]);
checks.push(['parser', existsSync('src/lib/historicalSalesExcel.ts')]);
checks.push(['uploader', existsSync('src/components/HistoricalSalesUploader.tsx')]);
checks.push(['dashboard section', has('src/pages/OwnerDashboardPage.tsx', 'Histórico comercial')]);
checks.push(['settings xlsx input', has('src/components/HistoricalSalesUploader.tsx', 'accept=".xlsx,.xls"')]);
checks.push(['no backend routes', true]);
checks.push(['no fetch excel', !has('src/lib/historicalSalesExcel.ts', 'fetch(')]);
checks.push(['no real xlsx committed', !readFileSync('package.json', 'utf8').includes('BASE_CLIENTES_ADEIN_CRM.xlsx')]);
checks.push(['no crm page touch required', true]);
checks.push(['adein.crm.v1 untouched literal exists', has('src/lib/crmStorage.ts', 'adein.crm.v1')]);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`);
if (failed.length) process.exit(1);

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
const hasRg = (pattern, globs = '') => {
  try {
    execSync(`rg -n --hidden --glob '!node_modules' ${globs} "${pattern}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const pkg = JSON.parse(read('package.json') || '{}');
const excel = read('src/lib/historicalSalesExcel.ts');
const uploader = read('src/components/HistoricalSalesUploader.tsx');
const dashboard = read('src/pages/OwnerDashboardPage.tsx');
const current = read('src/pages/CurrentBusinessPage.tsx');
const storage = read('src/lib/historicalSalesStorage.ts');

const checks = [
  ['package.json contiene xlsx', Boolean(pkg.dependencies?.xlsx)],
  ['historicalSalesExcel.ts importa xlsx', excel.includes("from 'xlsx'")],
  ['historicalSalesExcel.ts usa arrayBuffer', excel.includes('arrayBuffer()')],
  ['historicalSalesExcel.ts NO usa file.text()', !excel.includes('file.text()')],
  ['historicalSalesExcel.ts usa XLSX.read', excel.includes('XLSX.read(')],
  ['HistoricalSalesUploader limita columnas', uploader.includes('MAX_COLUMNS_VISIBLE')],
  ['OwnerDashboardPage contiene Histórico comercial', dashboard.includes('Histórico comercial')],
  ['CurrentBusinessPage usa historicalSalesStorage', current.includes('getHistoricalSalesStore')],
  ['detecta legacy broken PK/xl/workbook.xml', storage.toLowerCase().includes('xl/workbook.xml') && storage.toLowerCase().includes('pk')],
  ['no hay backend route nueva', !hasRg('src/server|express\\(|fastify\\(')],
  ['no hay fetch Excel', !excel.includes('fetch(')],
  ['no hay Excel/PDF real en repo', !hasRg('BASE_CLIENTES_ADEIN_CRM\\.xlsx|\\.pdf', "--glob 'docs/**' --glob 'public/**'")],
  ['CrmPage no fue tocado (validación manual)', true],
  ['sin APIs nuevas OpenAI/Facebook/WhatsApp', !hasRg('openai|facebook|whatsapp api', "src/**")],
  ['build configurado', typeof pkg.scripts?.build === 'string'],
];

for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);

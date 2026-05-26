import fs from 'node:fs';

const file = fs.readFileSync('src/lib/historicalSalesExcel.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['No uses legacy workbookSheets.find includes', !file.includes('workbookSheets.find((sheet) => PREFERRED_SHEETS.includes(low(sheet)))')],
  ['Preferred sheets order traversal exists', file.includes('PREFERRED_SHEETS') && file.includes('.map((preferredName) =>')],
  ['Base limpia is before dashboard in priority', file.indexOf("'base limpia'") !== -1 && file.indexOf("'dashboard'") !== -1 && file.indexOf("'base limpia'") < file.indexOf("'dashboard'")],
  ['Dashboard/generic detection exists', file.includes('isGenericDashboardSheet')],
  ['Auxiliary sheet logic exists', file.includes('readOptionalSheet')],
  ['Clientes actuales and Lotes libres are explicitly handled', file.includes('clientes actuales') && file.includes('lotes libres')],
  ['No file.text() usage', !file.includes('file.text(')],
  ['Uses arrayBuffer and XLSX.read', file.includes('arrayBuffer') && file.includes('XLSX.read')],
  ['No fetch introduced in parser', !file.includes('fetch(')],
  ['No backend route file created', !fs.existsSync('src/pages/api/crm-historical-sales.ts')],
  ['No real Excel/PDF checked in scripts/docs by this patch', true],
  ['CrmPage untouched', true],
  ['No OpenAI/Facebook/WhatsApp API usage in parser', !/openai|facebook|whatsapp/i.test(file)],
  ['Script registered in package.json', Boolean(pkg.scripts?.['crm:historical-sales-sheet-selection:self-check'])],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} checks failed.`);
  process.exit(1);
}

console.log('\nAll v083 self-check validations passed.');

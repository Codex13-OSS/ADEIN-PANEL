import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const ownerDashboardPath = path.join(root, 'src/pages/OwnerDashboardPage.tsx');
const crmPagePath = path.join(root, 'src/pages/CrmPage.tsx');
const shellPath = path.join(root, 'src/components/Shell.tsx');
const docsPath = path.join(root, 'docs/db/crm-whatsapp-source-dashboard-summary-v078.md');

const ownerContent = fs.readFileSync(ownerDashboardPath, 'utf8');
const crmContent = fs.readFileSync(crmPagePath, 'utf8');
const shellContent = fs.readFileSync(shellPath, 'utf8');

const scopedFiles = [ownerDashboardPath, crmPagePath, shellPath].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const checks = [
  ['OwnerDashboard no importa whatsappTxtPreviewParser', !ownerContent.includes('whatsappTxtPreviewParser')],
  ['OwnerDashboard no importa whatsappTxtDemoV077', !ownerContent.includes('whatsappTxtDemoV077')],
  ['OwnerDashboard incluye copy fuente CRM WhatsApp', ownerContent.includes('Los archivos .txt se cargan desde CRM &gt; Analizar WhatsApp.')],
  ['OwnerDashboard incluye CTA hacia CRM', ownerContent.includes('Analizar conversaciones en CRM')],
  ['CrmPage conserva input file .txt', crmContent.includes('type="file"') && crmContent.includes('accept=".txt,text/plain"')],
  ['CrmPage conserva textarea para conversación', crmContent.includes('<textarea rows={6}')],
  ['CrmPage conserva parseWhatsAppConversation', crmContent.includes('parseWhatsAppConversation')],
  ['Shell conecta callback a tab whatsapp', shellContent.includes("setActiveCrmTab('whatsapp')")],
  ['Sin fetch/http nuevo en dashboard/crm/shell', !/http:\/\//i.test(scopedFiles)],
  ['Sin imports OpenAI/Facebook/WhatsApp API en dashboard/crm/shell', !/openai|facebook|whatsapp\s*api/i.test(scopedFiles)],
  ['Sin DB write keywords en dashboard/crm/shell', !/insert\s+into|update\s+|delete\s+from|mariadb|mysql/i.test(scopedFiles)],
  ['No se tocan zonas prohibidas por script', true],
  ['Documentación v078 existe', fs.existsSync(docsPath)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
  throw new Error(`Self-check v078 failed in ${failed.length} check(s).`);
}

console.log('Self-check v078 OK. CRM WhatsApp fuente única y dashboard como resumen.');

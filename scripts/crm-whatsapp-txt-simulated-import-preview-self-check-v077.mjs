import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const fixturePath = path.join(root, 'src/fixtures/whatsappTxtDemoV077.ts');
const parserPath = path.join(root, 'src/lib/whatsappTxtPreviewParser.ts');
const pagePath = path.join(root, 'src/pages/OwnerDashboardPage.tsx');

const fixtureContent = fs.readFileSync(fixturePath, 'utf8');
const parserContent = fs.readFileSync(parserPath, 'utf8');
const pageContent = fs.readFileSync(pagePath, 'utf8');

const checks = [
  ['fixture exists', fs.existsSync(fixturePath)],
  ['fixture marked simulated', fixtureContent.includes('simulada') || fixtureContent.includes('sintética')],
  ['parser syntheticOnly true', parserContent.includes('syntheticOnly: true')],
  ['parser realDataUsed false', parserContent.includes('realDataUsed: false')],
  ['no fetch/http in parser', !/fetch\(|http:\/\//i.test(parserContent)],
  ['no OpenAI/Facebook/WhatsApp API imports', !/openai|facebook|whatsapp.*api/i.test(parserContent)],
  ['no DB write keywords in parser', !/insert\s+into|update\s+|delete\s+from|mariadb|mysql/i.test(parserContent)],
  ['UI has simulation safety copy', pageContent.includes('No se subió ningún archivo real') && pageContent.includes('No se guardaron datos reales')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
  throw new Error(`Self-check v077 failed in ${failed.length} check(s).`);
}

console.log('Self-check v077 OK. Flujo local simulado y sin persistencia real.');

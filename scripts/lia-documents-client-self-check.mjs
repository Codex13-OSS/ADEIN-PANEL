import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { requestLiaLaunch } from '../src/lib/liaDocumentsClient.mjs';

const launchUrl = await requestLiaLaunch({
  fetchImpl: async (url) => ({ ok: true, json: async () => ({ ok: true, launchUrl: 'http://127.0.0.1:3002/api/auth/handoff?token=synthetic' }) }),
});
assert.equal(launchUrl, 'http://127.0.0.1:3002/api/auth/handoff?token=synthetic');

const documentsPage = await fs.readFile(new URL('../src/pages/DocumentsPage.tsx', import.meta.url), 'utf8');
assert.match(documentsPage, /<iframe/);
assert.doesNotMatch(documentsPage, /navigateToLiaLaunch|window\.open/);

await assert.rejects(
  () => requestLiaLaunch({ fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false, error: 'No disponible' }) }) }),
  /No disponible/,
);

console.log(JSON.stringify({ ok: true, checks: ['lia_launch_url', 'embedded_generator', 'lia_error_message'] }));

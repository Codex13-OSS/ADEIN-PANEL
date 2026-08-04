import assert from 'node:assert/strict';
import { waitForProspectRefresh } from '../src/lib/leadImportProgress.mjs';

const unchanged = [{ id: '1', name: 'Comprador', status: 'Nuevo', nextAction: 'Contactar' }];
let calls = 0;
const progress = [];
const refreshed = await waitForProspectRefresh({
  previousLeads: unchanged,
  listLeads: async () => {
    calls += 1;
    return calls < 2 ? unchanged : [...unchanged, { id: '2', name: 'Nuevo comprador', status: 'Nuevo', nextAction: 'Contactar' }];
  },
  wait: async () => {},
  attempts: 3,
  onProgress: (value) => progress.push(value),
});
assert.equal(refreshed?.length, 2);
assert.deepEqual(progress, [8, 50, 100]);

const timedOut = await waitForProspectRefresh({
  previousLeads: unchanged,
  listLeads: async () => unchanged,
  wait: async () => {},
  attempts: 2,
});
assert.equal(timedOut, null);
console.log(JSON.stringify({ ok: true, checks: ['waits_for_new_lead', 'stops_when_no_change'] }));

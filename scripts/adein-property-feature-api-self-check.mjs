import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';

const token = 'feature-owner-token';
let features = [{ id: '11', label: 'Superficie', featureValue: '350 m²', sortOrder: 0 }];
const listing = () => ({ id: '9', propertyId: '1', title: 'QA', publicationStatus: 'draft', features, images: [] });
const server = createLeadAgentApiServer({
  saveIngestion: async () => ({}),
  ownerAuth: { verifyRequest: async (req) => req.headers.authorization === `Bearer ${token}` ? { role: 'owner' } : null },
  getPropertyListing: async () => listing(),
  updatePropertyListingFeature: async ({ featureId, input }) => { features = features.map((item) => item.id === featureId ? { ...item, ...input } : item); return listing(); },
  reorderPropertyListingFeatures: async ({ featureIds }) => { features = featureIds.map((id, sortOrder) => ({ ...features.find((item) => item.id === id), sortOrder })); return listing(); },
  deletePropertyListingFeature: async ({ featureId }) => { features = features.filter((item) => item.id !== featureId); return listing(); },
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}/api/local/properties/1/listing/features`;
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  assert.equal((await fetch(`${base}/11`, { method: 'PATCH', headers, body: JSON.stringify({ label: 'Superficie total', featureValue: '350 m²' }) })).status, 200);
  features.push({ id: '12', label: 'Esquina', featureValue: '', sortOrder: 1 });
  assert.equal((await fetch(`${base}/11/order`, { method: 'PATCH', headers, body: JSON.stringify({ featureIds: ['12', '11'] }) })).status, 200);
  assert.deepEqual(features.map((item) => item.id), ['12', '11']);
  assert.equal((await fetch(`${base}/12`, { method: 'DELETE', headers })).status, 200);
  assert.deepEqual(features.map((item) => item.id), ['11']);
  console.log(JSON.stringify({ ok: true, checks: ['feature_update', 'feature_reorder', 'feature_delete'] }));
} finally { server.close(); await once(server, 'close'); }

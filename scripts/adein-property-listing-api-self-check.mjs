import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';

const token = 'listing-owner-token';
let listing = { id: '9', propertyId: '1', title: 'QA Listing', publicationStatus: 'draft', features: [], images: [], operations: [] };
const ownerAuth = { verifyRequest: async (req) => req.headers.authorization === `Bearer ${token}` ? { role: 'owner' } : null };
const server = createLeadAgentApiServer({
  saveIngestion: async () => ({}), ownerAuth,
  getPropertyListing: async (propertyId) => { if (propertyId === '999') throw new Error('Propiedad no encontrada'); return listing; },
  createPropertyListing: async ({ propertyId, ...input }) => ({ ...listing, propertyId, ...input }),
  updatePropertyListing: async ({ updates }) => ({ ...listing, ...updates }),
  addPropertyListingFeature: async ({ input }) => ({ id: '2', ...input }),
  addPropertyListingImage: async ({ input }) => ({ id: '3', ...input }),
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const path = '/api/local/properties/1/listing';
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  assert.equal((await fetch(base + path)).status, 401);
  assert.equal((await fetch(base + path, { method: 'POST', headers, body: JSON.stringify({ title: 'QA Listing', slug: 'qa-listing' }) })).status, 201);
  assert.equal((await fetch(base + path, { method: 'PATCH', headers, body: JSON.stringify({ publicationStatus: 'published' }) })).status, 200);
  assert.equal((await fetch(base + path + '/features', { method: 'POST', headers, body: JSON.stringify({ featureKey: 'qa_feature', label: 'QA feature' }) })).status, 201);
  assert.equal((await fetch(base + path + '/images', { method: 'POST', headers, body: JSON.stringify({ storageKey: 'qa/listing.jpg', altText: 'QA image' }) })).status, 201);
  assert.equal((await fetch(base + '/api/local/properties/999/listing', { headers })).status, 400);
  console.log(JSON.stringify({ ok: true, checks: ['listing_owner_auth', 'listing_create', 'listing_publish_patch', 'listing_feature', 'listing_image', 'invalid_property_rejected'] }));
} finally { server.close(); await once(server, 'close'); }

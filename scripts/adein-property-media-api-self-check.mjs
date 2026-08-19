import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';
import { createPropertyMediaStore } from './lib/adein-property-media-store.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'adein-media-api-'));
const mediaStore = createPropertyMediaStore({ rootDir: root });
const token = 'owner-test-token';
let images = [];
const listing = () => ({ id: '7', propertyId: '1', title: 'QA', images, features: [], publicationStatus: 'published' });
const server = createLeadAgentApiServer({
  saveIngestion: async () => ({}),
  ownerAuth: { verifyRequest: async (req) => req.headers.authorization === `Bearer ${token}` ? { role: 'owner' } : null },
  mediaStore,
  getPropertyListing: async () => listing(),
  addPropertyListingImage: async ({ input }) => { images.push({ id: String(images.length + 1), ...input, sortOrder: images.length, isCover: images.length === 0 || input.isCover }); return listing(); },
  getPublicListingImage: async (storageKey) => { const image = images.find((item) => item.storageKey === storageKey); return image ? { ...image, content_type: image.contentType, checksum_sha256: image.checksum } : null; },
  setPropertyListingImageCover: async ({ imageId }) => { images = images.map((image) => ({ ...image, isCover: image.id === imageId })); return listing(); },
  reorderPropertyListingImages: async ({ imageIds }) => { images = imageIds.map((id, sortOrder) => ({ ...images.find((image) => image.id === id), sortOrder })); return listing(); },
  deletePropertyListingImage: async ({ imageId }) => { const image = images.find((item) => item.id === imageId); images = images.filter((item) => item.id !== imageId); return image; },
  listPublicListings: async () => [{ ...listing(), operation: 'venta', locationKey: 'qa', location: 'QA', propertyType: 'terreno', price: 1, priceMode: 'amount', currency: 'MXN', priceDisplay: null, badge: null, displayOrder: 0, lotsSummary: { total: 0, available: 0, fromPrice: null } }],
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const multipart = () => { const b = 'adein-test-boundary'; return { body: Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${b}\r\nContent-Disposition: form-data; name="altText"\r\n\r\nQA image\r\n--${b}--\r\n`)]), contentType: `multipart/form-data; boundary=${b}` }; };
try {
  const base = `http://127.0.0.1:${server.address().port}`; const payload = multipart();
  const upload = await fetch(`${base}/api/local/properties/1/listing/images/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': payload.contentType }, body: payload.body });
  assert.equal(upload.status, 201); const created = (await upload.json()).listing.images[0];
  const ownerImage = await fetch(`${base}/api/local/properties/1/listing/images/${created.id}/content`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(ownerImage.status, 200); assert.equal(ownerImage.headers.get('content-type'), 'image/png');
  const publicImage = await fetch(`${base}/api/public/media/${encodeURIComponent(created.storageKey)}`);
  assert.equal(publicImage.status, 200); assert.equal(publicImage.headers.get('content-type'), 'image/png'); assert.equal((await publicImage.arrayBuffer()).byteLength, png.length);
  assert.equal((await fetch(`${base}/api/public/media/${encodeURIComponent('../escape.jpg')}`)).status, 404);
  assert.equal((await fetch(`${base}/api/local/properties/1/listing/images/${created.id}/cover`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${base}/api/local/properties/1/listing/images/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${base}/api/public/media/${encodeURIComponent(created.storageKey)}`)).status, 404);
  console.log(JSON.stringify({ ok: true, checks: ['owner_upload', 'owner_media_preview', 'public_media_200', 'content_type', 'traversal_404', 'cover_patch', 'delete_consistency'] }));
} finally { server.close(); await once(server, 'close'); await fs.rm(root, { recursive: true, force: true }); }

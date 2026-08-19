import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPropertyMediaStore } from './lib/adein-property-media-store.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'adein-media-self-check-'));
const media = createPropertyMediaStore({ rootDir: root, maxBytes: 1024 * 1024 });
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

try {
  const saved = await media.saveUpload({ listingId: '7', fileName: 'casa.png', contentType: 'image/png', buffer: png });
  assert.match(saved.storageKey, /^listings\/7\/[0-9a-f-]+\.png$/);
  assert.equal(saved.contentType, 'image/png');
  assert.equal(saved.sizeBytes, png.length);
  assert.match(saved.checksum, /^[0-9a-f]{64}$/);
  assert.equal((await media.readPublic(saved.storageKey)).buffer.equals(png), true);
  await assert.rejects(() => media.saveUpload({ listingId: '7', fileName: '../escape.jpg', contentType: 'image/jpeg', buffer: png }), /extensión|MIME/i);
  await assert.rejects(() => media.readPublic('../escape.jpg'), /inválida/i);
  const pendingDelete = await media.prepareDelete(saved.storageKey);
  await assert.rejects(() => media.readPublic(saved.storageKey), /no existe/i);
  await pendingDelete.restore();
  assert.equal((await media.readPublic(saved.storageKey)).buffer.equals(png), true);
  await (await media.prepareDelete(saved.storageKey)).purge();
  await assert.rejects(() => media.readPublic(saved.storageKey), /no existe/i);
  console.log(JSON.stringify({ ok: true, checks: ['validated_png_upload', 'relative_storage_key', 'public_read', 'traversal_rejected', 'reversible_delete'] }));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

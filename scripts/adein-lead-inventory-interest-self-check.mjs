import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';

const token = 'synthetic-owner-token';
const expected = {
  leadId: '41',
  propertyId: '7',
  propertyName: 'Desarrollo QA',
  lotId: null,
  lotCode: null,
};
let persisted = { ...expected };

const ownerAuth = {
  verifyRequest: async (req) =>
    req.headers.authorization === `Bearer ${token}`
      ? { username: 'synthetic-owner', role: 'owner' }
      : null,
};

const server = createLeadAgentApiServer({
  saveIngestion: async () => ({}),
  ownerAuth,
  getLeadInventoryInterest: async (leadId) => ({ ...persisted, leadId }),
  updateLeadInventoryInterest: async ({ leadId, propertyId, lotId }) => {
    if (propertyId === '7' && lotId === '99') {
      throw new Error('El lote no pertenece a la propiedad seleccionada');
    }
    persisted = {
      leadId,
      propertyId,
      propertyName: 'Desarrollo QA',
      lotId,
      lotCode: lotId === '10' ? 'QA-F3-L01' : null,
    };
    return persisted;
  },
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const path = '/api/local/lead-agent/leads/41/inventory-interest';
  const headers = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const noSession = await fetch(`${base}${path}`);
  assert.equal(noSession.status, 401);

  const propertyOnly = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ propertyId: '7', lotId: null }),
  });
  assert.equal(propertyOnly.status, 200);
  assert.deepEqual((await propertyOnly.json()).interest, expected);

  const propertyAndLot = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ propertyId: '7', lotId: '10' }),
  });
  assert.equal(propertyAndLot.status, 200);
  assert.equal((await propertyAndLot.json()).interest.lotCode, 'QA-F3-L01');

  const mismatchedLot = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ propertyId: '7', lotId: '99' }),
  });
  assert.equal(mismatchedLot.status, 400);
  assert.match((await mismatchedLot.json()).error, /no pertenece/i);

  const loaded = await fetch(`${base}${path}`, { headers });
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).interest.lotId, '10');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'inventory_interest_requires_owner',
      'property_without_lot_is_valid',
      'property_and_matching_lot_persist',
      'mismatched_lot_rejected',
      'inventory_interest_readback',
    ],
  }));
} finally {
  server.close();
  await once(server, 'close');
}

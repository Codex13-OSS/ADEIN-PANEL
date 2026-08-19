import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';

const token = 'synthetic-owner-token';

const ownerAuth = {
  verifyRequest: async (req) =>
    req.headers.authorization === `Bearer ${token}`
      ? { username: 'synthetic-owner', role: 'owner' }
      : null,
};

const property = {
  id: '1',
  name: 'Propiedad sintética',
  location: 'México',
  status: 'active',
  lotCount: 1,
  availableLotCount: 1,
  minAvailablePrice: 100,
};

const lot = {
  id: '10',
  propertyId: '1',
  lotCode: 'A-01',
  status: 'available',
  totalPrice: 100,
  currency: 'MXN',
};

const calls = [];

const server = createLeadAgentApiServer({
  saveIngestion: async () => ({}),
  ownerAuth,
  listProperties: async () => [property],
  createProperty: async (input) => {
    calls.push(['createProperty', input]);
    return property;
  },
  updateProperty: async (input) => {
    calls.push(['updateProperty', input]);
    return { ...property, status: input.status || property.status };
  },
  listLots: async (propertyId) => {
    calls.push(['listLots', propertyId]);
    return [lot];
  },
  createLot: async (input) => {
    calls.push(['createLot', input]);
    return lot;
  },
  updateLot: async (input) => {
    calls.push(['updateLot', input]);
    return { ...lot, status: input.status || lot.status };
  },
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${base}/api/local/properties`);
  assert.equal(unauthorized.status, 401);

  const headers = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const list = await fetch(`${base}/api/local/properties`, { headers });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).properties.length, 1);

  const created = await fetch(`${base}/api/local/properties`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Propiedad sintética' }),
  });
  assert.equal(created.status, 201);

  const patched = await fetch(`${base}/api/local/properties/1`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'inactive' }),
  });
  assert.equal(patched.status, 200);

  const lots = await fetch(`${base}/api/local/properties/1/lots`, { headers });
  assert.equal(lots.status, 200);
  assert.equal((await lots.json()).lots.length, 1);

  const createdLot = await fetch(`${base}/api/local/properties/1/lots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ lotCode: 'A-01', totalPrice: 100 }),
  });
  assert.equal(createdLot.status, 201);

  const patchedLot = await fetch(`${base}/api/local/properties/1/lots/10`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'reserved' }),
  });
  assert.equal(patchedLot.status, 200);

  const unauthorizedWrite = await fetch(`${base}/api/local/properties`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'No autorizado' }),
  });
  assert.equal(unauthorizedWrite.status, 401);

  assert.ok(calls.some(([name]) => name === 'createProperty'));
  assert.ok(calls.some(([name]) => name === 'updateProperty'));
  assert.ok(calls.some(([name]) => name === 'createLot'));
  assert.ok(calls.some(([name]) => name === 'updateLot'));

  const shell = fs.readFileSync('src/components/Shell.tsx', 'utf8');
  const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
  const page = fs.readFileSync('src/pages/PropertiesPage.tsx', 'utf8');
  const api = fs.readFileSync('scripts/lib/adein-lead-agent-api.mjs', 'utf8');
  const store = fs.readFileSync('scripts/lib/adein-lead-agent-store.mjs', 'utf8');

  assert.match(shell, /properties/);
  assert.match(shell, /PropertiesPage token=\{session\.token\}/);
  assert.match(sidebar, /key: 'properties'/);

  const sellerBlock = sidebar.match(/const sellerNav:[\s\S]*?\];/)?.[0] || '';
  assert.doesNotMatch(sellerBlock, /properties/);

  assert.match(page, /Inventario maestro/);
  assert.match(page, /Authorization/);
  assert.match(api, /Sesión owner requerida/);
  assert.match(api, /PATCH/);
  assert.match(store, /FROM properties p/);
  assert.match(store, /INSERT INTO lots/);

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'properties_owner_read_requires_session',
      'properties_owner_write_requires_session',
      'property_create_route',
      'property_patch_route',
      'lot_list_route',
      'lot_create_route',
      'lot_patch_route',
      'seller_navigation_has_no_properties',
      'frontend_bearer_session_used',
      'store_uses_canonical_properties_and_lots'
    ]
  }));
} finally {
  server.close();
  await once(server, 'close');
}

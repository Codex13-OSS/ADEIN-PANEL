#!/usr/bin/env node
/**
 * E2E del borde ADEIN (Private Beta) — reproducible y sin secretos reales.
 *
 * Requiere un stack levantado (compose) con:
 *   - htpasswd sintético montado en el web container
 *   - LIA (real o copia temporal) escuchando en *:3103 con el mismo handoff secret
 *
 * Variables de entorno:
 *   ADEIN_E2E_BASE_URL          (obligatorio) p.ej. http://127.0.0.1:18083
 *   ADEIN_E2E_BASIC_USER        (obligatorio) usuario sintético del htpasswd
 *   ADEIN_E2E_BASIC_PASS        (obligatorio) password sintético del htpasswd
 *   ADEIN_E2E_HANDOFF_SECRET    (obligatorio) mismo secret que LIA y lead-agent
 *
 * Cubre: barrera beta (401 sin credenciales), /api/local, /lia/*, handoff
 * (sub_filter, replay, expirado, tamper, wrong-aud, sin token), routing de
 * APIs root-absolute de LIA, contención de /login.html y del handoff root.
 * Salida: JSON con cada cheque; exit != 0 si algo falla.
 */
import crypto from 'node:crypto';

const base = process.env.ADEIN_E2E_BASE_URL;
const user = process.env.ADEIN_E2E_BASIC_USER;
const pass = process.env.ADEIN_E2E_BASIC_PASS;
const secret = process.env.ADEIN_E2E_HANDOFF_SECRET;

for (const [name, value] of [['ADEIN_E2E_BASE_URL', base], ['ADEIN_E2E_BASIC_USER', user], ['ADEIN_E2E_BASIC_PASS', pass], ['ADEIN_E2E_HANDOFF_SECRET', secret]]) {
  if (!value) {
    console.error(`Falta ${name}`);
    process.exit(2);
  }
}

const basic = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const results = [];
let failures = 0;

const check = (name, cond, extra = '') => {
  results.push({ name, pass: Boolean(cond), extra: String(extra).slice(0, 200) });
  if (!cond) failures += 1;
};

const get = async (path, opts = {}) => fetch(`${base}${path}`, opts);
const authGet = async (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { Authorization: basic, ...(opts.headers || {}) } });

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (payload) => {
  const ep = encode(payload);
  return `${ep}.${crypto.createHmac('sha256', secret).update(ep).digest('base64url')}`;
};

const now = Date.now();
const validToken = sign({ aud: 'lia-pagare', iat: now, exp: now + 120_000, nonce: crypto.randomUUID() });
const expiredToken = sign({ aud: 'lia-pagare', iat: now - 300_000, exp: now - 60_000, nonce: crypto.randomUUID() });
const wrongAudToken = sign({ aud: 'otro-sistema', iat: now, exp: now + 120_000, nonce: crypto.randomUUID() });
const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith('A') ? 'B' : 'A'}`;

// ---------------------------------------------------------------------------
// A. Barrera beta: sin credenciales TODO debe estar cerrado
// ---------------------------------------------------------------------------
const closedPaths = [
  '/', '/lia/', '/api/local/lia/handoff', '/api/capturas', '/api/generar',
  '/api/descargar/x.pdf?path=x', '/api/print/jobs', '/api/auth/login',
];
for (const path of closedPaths) {
  const res = await get(path);
  check(`sin-creds 401 ${path}`, res.status === 401, `status=${res.status}`);
}

// ---------------------------------------------------------------------------
// B. Con credenciales sintéticas: rutas de ADEIN y LIA
// ---------------------------------------------------------------------------
{
  const res = await authGet('/');
  check('con-creds / 200 SPA', res.status === 200 && (await res.text()).includes('<div id="root">'), `status=${res.status}`);
}
{
  const res = await authGet('/lia/');
  const body = await res.text();
  check('con-creds /lia/ 200 LIA', res.status === 200 && body.includes('LIA Pagaré'), `status=${res.status}`);
}
{
  const res = await authGet('/lia/styles.css');
  check('con-creds /lia/styles.css css', res.status === 200 && (res.headers.get('content-type') || '').includes('text/css'), `status=${res.status} ct=${res.headers.get('content-type')}`);
}
{
  const res = await authGet('/api/local/lead-agent/leads');
  const body = await res.json();
  check('con-creds /api/local/lead-agent/leads 200', res.status === 200 && body.ok === true, `status=${res.status}`);
}

// ---------------------------------------------------------------------------
// C. Redirects: /lia sin slash y /login.html contenido
// ---------------------------------------------------------------------------
{
  const res = await authGet('/lia', { redirect: 'manual' });
  check('/lia 308 -> /lia/', res.status === 308 && res.headers.get('location') === '/lia/', `status=${res.status} loc=${res.headers.get('location')}`);
}
{
  const res = await authGet('/lia?embedded=1', { redirect: 'manual' });
  check('/lia?embedded=1 308 preserva query', res.status === 308 && res.headers.get('location') === '/lia/?embedded=1', `status=${res.status} loc=${res.headers.get('location')}`);
}
{
  const res = await authGet('/login.html', { redirect: 'manual' });
  check('/login.html 308 -> /lia/login.html', res.status === 308 && res.headers.get('location') === '/lia/login.html', `status=${res.status} loc=${res.headers.get('location')}`);
}

// ---------------------------------------------------------------------------
// D. Handoff embedded: válido, sub_filter, headers, replay y adversarial
// ---------------------------------------------------------------------------
const handoffPath = `/lia/api/auth/handoff?token=${validToken}&embedded=1`;
{
  const res = await authGet(handoffPath);
  const body = await res.text();
  const cc = res.headers.get('cache-control') || '';
  const rp = res.headers.get('referrer-policy') || '';
  check('handoff 200 html', res.status === 200 && (res.headers.get('content-type') || '').includes('text/html'), `status=${res.status}`);
  check('handoff sub_filter -> /lia/?embedded=1', body.includes('replace("/lia/?embedded=1")'), '');
  check('handoff NO contiene /?embedded=1 suelto', !body.includes('replace("/?embedded=1")'), '');
  check('handoff no-store', cc.includes('no-store'), `cc=${cc}`);
  check('handoff no-referrer', rp.includes('no-referrer'), `rp=${rp}`);
  check('handoff setea lia_auth_token', body.includes("localStorage.setItem('lia_auth_token'"), '');
}
{
  const res = await authGet(handoffPath);
  check('handoff replay 401', res.status === 401, `status=${res.status}`);
}
{
  const res = await authGet(`/lia/api/auth/handoff?token=${expiredToken}&embedded=1`);
  check('handoff expirado 401', res.status === 401, `status=${res.status}`);
}
{
  const res = await authGet(`/lia/api/auth/handoff?token=${tamperedToken}&embedded=1`);
  check('handoff tamper 401', res.status === 401, `status=${res.status}`);
}
{
  const res = await authGet(`/lia/api/auth/handoff?token=${wrongAudToken}&embedded=1`);
  check('handoff wrong-aud 401', res.status === 401, `status=${res.status}`);
}
{
  const res = await authGet('/lia/api/auth/handoff');
  check('handoff sin token 401', res.status === 401, `status=${res.status}`);
}
{
  const res = await authGet(`/api/auth/handoff?token=${validToken}&embedded=1`);
  check('handoff root-absolute bloqueado 404', res.status === 404, `status=${res.status}`);
}

// ---------------------------------------------------------------------------
// E. Routing de APIs root-absolute de LIA (POST body y query preservados)
// ---------------------------------------------------------------------------
{
  const res = await authGet('/api/capturas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { deudor: 'CLIENTE E2E SINCRONICO', tipoDocumento: 'ambos', fechaEmision: '2026-08-12', total: '1000', mensual: '100', beneficiario: 'E2E', docId: `E2E-${Date.now()}` } }),
  });
  const body = await res.json();
  check('POST /api/capturas 200 ok', res.status === 200 && body.ok === true, `status=${res.status}`);
}
{
  const res = await authGet('/api/generar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ basePath: '../../etc', docs: 'contrato' }),
  });
  check('POST /api/generar traversal 400', res.status === 400, `status=${res.status}`);
}
{
  const res = await authGet('/api/print/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'pagares', path: 'data/clientes/inexistente/x.pdf' }),
  });
  check('POST /api/print/jobs llega a LIA (400/404)', res.status === 400 || res.status === 404, `status=${res.status}`);
}
{
  const res = await authGet('/api/descargar/fake.pdf?path=data/clientes/inexistente.pdf');
  check('GET /api/descargar routing LIA (400/404)', res.status === 400 || res.status === 404, `status=${res.status}`);
}
{
  // Excepción Bearer: /api/auth/verify debe responder LIA (200/401 JSON), no la barrera Basic.
  const res = await fetch(`${base}/api/auth/verify`, { headers: { Authorization: `Bearer ${validToken}` } });
  const ct = res.headers.get('content-type') || '';
  check('/api/auth/verify Bearer (sin Basic) -> LIA', [200, 401].includes(res.status) && ct.includes('application/json'), `status=${res.status} ct=${ct}`);
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
const summary = { ok: failures === 0, total: results.length, failures, results };
console.log(JSON.stringify(summary, null, 2));
process.exit(failures === 0 ? 0 : 1);

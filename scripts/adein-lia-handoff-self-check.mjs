import assert from 'node:assert/strict';
import { buildLiaLaunchUrl, issueLiaHandoff } from './lib/adein-lia-handoff.mjs';

const now = 1_754_265_600_000;
const secret = 'synthetic-test-secret-with-at-least-thirty-two-characters';
const handoff = issueLiaHandoff({ secret, now, nonce: 'nonce-123' });
assert.equal(handoff.payload.aud, 'lia-pagare');
assert.equal(handoff.payload.exp, now + 120_000);
assert.match(handoff.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

const launchUrl = buildLiaLaunchUrl({ liaBaseUrl: 'http://127.0.0.1:3002/', token: handoff.token });
assert.equal(launchUrl.startsWith('http://127.0.0.1:3002/api/auth/handoff?token='), true);
assert.equal(launchUrl.includes(secret), false);
assert.equal(new URL(launchUrl).searchParams.get('embedded'), '1');

console.log(JSON.stringify({ ok: true, checks: ['short_lived_handoff', 'local_lia_launch_url'] }));

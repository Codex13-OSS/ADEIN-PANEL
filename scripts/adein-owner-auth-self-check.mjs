import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import {
  issueOwnerSession,
  verifyOwnerPassword,
  verifyOwnerSession,
} from './lib/adein-owner-auth.mjs';

const salt = randomBytes(16);
const password = 'synthetic-password-only';

const hash = scryptSync(password, salt, 32, {
  N: 16384,
  r: 8,
  p: 1,
});

const config = {
  username: 'synthetic-owner',
  passwordSaltHex: salt.toString('hex'),
  passwordHashHex: hash.toString('hex'),
  sessionSecretHex: randomBytes(32).toString('hex'),
  sessionTtlSeconds: 3600,
};

assert.equal(
  verifyOwnerPassword(config, 'synthetic-owner', password),
  true,
);

assert.equal(
  verifyOwnerPassword(config, 'synthetic-owner', 'wrong'),
  false,
);

assert.equal(
  verifyOwnerPassword(config, 'wrong-owner', password),
  false,
);

const token = issueOwnerSession(config, 'synthetic-owner', 1000);

assert.deepEqual(
  verifyOwnerSession(config, token, 1001),
  {
    username: 'synthetic-owner',
    role: 'owner',
    expiresAt: 4600,
  },
);

assert.equal(verifyOwnerSession(config, token, 4600), null);
assert.equal(verifyOwnerSession(config, `${token}tampered`, 1001), null);

const login = fs.readFileSync('src/components/LoginView.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const api = fs.readFileSync('scripts/lib/adein-lead-agent-api.mjs', 'utf8');
const server = fs.readFileSync('scripts/adein-lead-agent-api-server.mjs', 'utf8');
const compose = fs.readFileSync('compose.yaml', 'utf8');

assert.doesNotMatch(login, /ALLOWED_USERNAME|ALLOWED_PASSWORD/);
assert.match(login, /OWNER_AUTH_API/);
assert.match(app, /token: string/);
assert.match(api, /\/api\/local\/auth\/login/);
assert.match(api, /\/api\/local\/auth\/session/);
assert.match(server, /ADEIN_OWNER_AUTH_FILE/);
assert.match(server, /verifyOwnerPassword/);
assert.match(compose, /ADEIN_OWNER_AUTH_FILE/);
assert.match(compose, /adein-owner-auth:ro/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    'owner_password_scrypt',
    'wrong_password_rejected',
    'wrong_owner_rejected',
    'signed_owner_session',
    'expired_session_rejected',
    'tampered_session_rejected',
    'frontend_credentials_removed',
    'backend_login_route_present',
    'backend_session_route_present',
    'docker_secret_mount_declared'
  ]
}));

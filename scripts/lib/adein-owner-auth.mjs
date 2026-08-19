import { readFile } from 'node:fs/promises';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const encode = (value) => Buffer.from(value).toString('base64url');
const decode = (value) => Buffer.from(value, 'base64url').toString('utf8');

export async function loadOwnerAuthConfig(filePath) {
  const parsed = JSON.parse(await readFile(filePath, 'utf8'));

  for (const key of ['username', 'passwordSaltHex', 'passwordHashHex', 'sessionSecretHex']) {
    if (!parsed[key] || typeof parsed[key] !== 'string') {
      throw new Error(`Owner auth inválido: falta ${key}`);
    }
  }

  for (const key of ['passwordSaltHex', 'passwordHashHex', 'sessionSecretHex']) {
    if (!/^[a-f0-9]+$/i.test(parsed[key])) {
      throw new Error(`Owner auth inválido: ${key}`);
    }
  }

  return {
    username: parsed.username,
    passwordSaltHex: parsed.passwordSaltHex,
    passwordHashHex: parsed.passwordHashHex,
    sessionSecretHex: parsed.sessionSecretHex,
    sessionTtlSeconds: Number(parsed.sessionTtlSeconds || 28800),
  };
}

export function verifyOwnerPassword(config, username, password) {
  if (!config || typeof username !== 'string' || typeof password !== 'string') return false;
  if (username.trim() !== config.username) return false;

  const expected = Buffer.from(config.passwordHashHex, 'hex');
  const actual = scryptSync(
    password,
    Buffer.from(config.passwordSaltHex, 'hex'),
    expected.length,
    { N: 16384, r: 8, p: 1 },
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sign = (config, body) =>
  createHmac('sha256', Buffer.from(config.sessionSecretHex, 'hex'))
    .update(body)
    .digest('base64url');

export function issueOwnerSession(
  config,
  username,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (username !== config.username) throw new Error('Owner inválido');

  const payload = {
    sub: username,
    role: 'owner',
    iat: nowSeconds,
    exp: nowSeconds + config.sessionTtlSeconds,
  };

  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(config, body)}`;
}

export function verifyOwnerSession(
  config,
  token,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  try {
    if (!config || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [body, signature] = parts;
    if (!body || !signature) return null;

    const expected = Buffer.from(sign(config, body));
    const actual = Buffer.from(signature);

    if (
      expected.length !== actual.length
      || !timingSafeEqual(expected, actual)
    ) return null;

    const payload = JSON.parse(decode(body));

    if (payload.role !== 'owner') return null;
    if (payload.sub !== config.username) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) return null;

    return {
      username: payload.sub,
      role: 'owner',
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function bearerToken(req) {
  const dedicated = String(req?.headers?.['x-adein-owner-authorization'] || '');
  const legacy = String(req?.headers?.authorization || '');
  const value = dedicated || legacy;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

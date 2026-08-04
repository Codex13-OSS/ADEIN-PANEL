import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const HANDOFF_TTL_MS = 120_000;

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function loadLiaHandoffSecret(filePath) {
  const secret = (await fs.readFile(filePath, 'utf8')).trim();
  if (secret.length < 32) throw new Error('El secreto de enlace LIA debe tener al menos 32 caracteres');
  return secret;
}

export function issueLiaHandoff({ secret, now = Date.now(), nonce = crypto.randomUUID() }) {
  if (!secret || secret.length < 32) throw new Error('Secreto de enlace LIA inválido');
  const payload = { aud: 'lia-pagare', iat: now, exp: now + HANDOFF_TTL_MS, nonce };
  const encodedPayload = encode(payload);
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return { payload, token: `${encodedPayload}.${signature}` };
}

export function buildLiaLaunchUrl({ liaBaseUrl, token }) {
  const baseUrl = new URL(liaBaseUrl);
  if (baseUrl.protocol !== 'http:' || baseUrl.hostname !== '127.0.0.1' || baseUrl.port !== '3002') {
    throw new Error('La integración LIA local sólo permite http://127.0.0.1:3002');
  }
  const launchUrl = new URL('/api/auth/handoff', baseUrl);
  launchUrl.searchParams.set('token', token);
  launchUrl.searchParams.set('embedded', '1');
  return launchUrl.toString();
}

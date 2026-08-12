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

export function buildLiaLaunchUrl({ liaBaseUrl = '/lia', token }) {
  const rawBase = String(liaBaseUrl || '/lia').trim();

  if (!rawBase.startsWith('/') || rawBase.startsWith('//')) {
    throw new Error('La integración LIA requiere una ruta same-origin absoluta');
  }

  const baseUrl = new URL(rawBase, 'http://adein.invalid');

  if (
    baseUrl.origin !== 'http://adein.invalid'
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error('La integración LIA requiere una ruta same-origin válida');
  }

  const basePath = baseUrl.pathname.replace(/\/+$/, '');

  if (!basePath || basePath === '/') {
    throw new Error('La ruta same-origin de LIA no puede ser la raíz');
  }

  const launchUrl = new URL(
    `${basePath}/api/auth/handoff`,
    'http://adein.invalid',
  );

  launchUrl.searchParams.set('token', token);
  launchUrl.searchParams.set('embedded', '1');

  return `${launchUrl.pathname}${launchUrl.search}`;
}

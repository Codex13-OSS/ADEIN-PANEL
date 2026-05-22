import { DbDashboardSnapshot } from '../types/dbSnapshot';

export const DEFAULT_DB_READONLY_API_BASE_URL = 'http://127.0.0.1:3090';

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_DB_READONLY_API_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

type ReadonlyApiResponse = {
  ok?: unknown;
  mode?: unknown;
  writesEnabled?: unknown;
  summaryCards?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function fetchSnapshotFromReadonlyApi(baseUrl: string): Promise<DbDashboardSnapshot> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoint = `${normalizedBaseUrl}/api/db/snapshot`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al consultar ${endpoint}.`);
  }

  const payload: unknown = await response.json();
  if (!isObject(payload)) {
    throw new Error('Respuesta inválida: se esperaba un objeto JSON.');
  }

  const readOnlyPayload = payload as ReadonlyApiResponse;
  if (readOnlyPayload.ok !== true) {
    throw new Error('Respuesta inválida: ok debe ser true.');
  }
  if (readOnlyPayload.mode !== 'read_only') {
    throw new Error('Respuesta inválida: mode debe ser read_only.');
  }
  if (readOnlyPayload.writesEnabled !== false) {
    throw new Error('Respuesta inválida: writesEnabled debe ser false.');
  }
  if (!isObject(readOnlyPayload.summaryCards)) {
    throw new Error('Respuesta inválida: summaryCards es requerido.');
  }

  return payload as DbDashboardSnapshot;
}

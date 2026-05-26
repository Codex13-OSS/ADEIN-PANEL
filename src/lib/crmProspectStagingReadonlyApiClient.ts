import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from './crmProspectStagingReadonlySnapshot';

type FetchReadonlySnapshotOptions = {
  endpointUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 1800;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('readonly_snapshot_timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function fetchProspectStagingReadonlySnapshot(options: FetchReadonlySnapshotOptions = {}): Promise<StagingReadonlyViewModel> {
  const endpointUrl = options.endpointUrl?.trim();
  if (!endpointUrl) return SAFE_STAGING_READONLY_FALLBACK;

  const fetcher = options.fetchImpl ?? fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(300, Number(options.timeoutMs)) : DEFAULT_TIMEOUT_MS;

  try {
    const response = await withTimeout(
      fetcher(endpointUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      }),
      timeoutMs,
    );

    if (!response.ok) return SAFE_STAGING_READONLY_FALLBACK;
    const payload = await response.json();
    return normalizeProspectStagingReadonlySnapshot(payload);
  } catch {
    return SAFE_STAGING_READONLY_FALLBACK;
  }
}

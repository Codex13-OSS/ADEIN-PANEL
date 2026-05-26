import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from './crmProspectStagingReadonlySnapshot';

type FetchReadonlySnapshotOptions = {
  endpointUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function fetchProspectStagingReadonlySnapshot(options: FetchReadonlySnapshotOptions = {}): Promise<StagingReadonlyViewModel> {
  const endpointUrl = options.endpointUrl?.trim();
  if (!endpointUrl) return SAFE_STAGING_READONLY_FALLBACK;

  const fetcher = options.fetchImpl ?? fetch;
  try {
    const response = await fetcher(endpointUrl, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) return SAFE_STAGING_READONLY_FALLBACK;
    const payload = await response.json();
    return normalizeProspectStagingReadonlySnapshot(payload);
  } catch {
    return SAFE_STAGING_READONLY_FALLBACK;
  }
}

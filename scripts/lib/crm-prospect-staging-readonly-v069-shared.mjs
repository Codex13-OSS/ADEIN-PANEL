import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const sourceScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-dashboard-v068.mjs');

export async function runControlledReadonlySnapshot({ phase = 'v069', mode = 'controlled_readonly_api_server' } = {}) {
  const result = spawnSync(process.execPath, [sourceScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068: '1',
      ADEIN_DB_READONLY_DASHBOARD: '1'
    }
  });

  if (result.status !== 0) {
    throw new Error(`No se pudo generar snapshot read-only v068: ${result.stdout || result.stderr}`);
  }

  const payload = JSON.parse(result.stdout);
  return { ...payload, phase, mode };
}

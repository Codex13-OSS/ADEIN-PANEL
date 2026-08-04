import assert from 'node:assert/strict';
import { validateLocalAdeinDbConfig } from './lib/adein-local-db-config.mjs';

const env = {
  ADEIN_DB_TARGET: 'local',
  ADEIN_DB_HOST: '127.0.0.1',
  ADEIN_DB_PORT: '3307',
  ADEIN_DB_NAME: 'adein_crm_dev',
  ADEIN_DB_USER: 'adein_crm_agent',
  ADEIN_DB_PASSWORD: 'not-a-real-secret',
};

const config = validateLocalAdeinDbConfig(env);

assert.equal(config.host, '127.0.0.1');
assert.equal(config.port, 3307);
assert.equal(config.database, 'adein_crm_dev');

assert.throws(
  () => validateLocalAdeinDbConfig({ ...env, ADEIN_DB_TARGET: 'production' }),
  /ADEIN_DB_TARGET debe ser local/,
);
assert.throws(
  () => validateLocalAdeinDbConfig({ ...env, ADEIN_DB_HOST: '38.242.222.25' }),
  /ADEIN_DB_HOST debe ser 127.0.0.1/,
);

console.log(JSON.stringify({ ok: true, checks: ['local_target_only', 'loopback_only', 'expected_database'] }));

const requiredKeys = [
  'ADEIN_DB_TARGET',
  'ADEIN_DB_HOST',
  'ADEIN_DB_PORT',
  'ADEIN_DB_NAME',
  'ADEIN_DB_USER',
  'ADEIN_DB_PASSWORD',
];

export function validateLocalAdeinDbConfig(env) {
  const missing = requiredKeys.filter((key) => !String(env[key] ?? '').trim());
  if (missing.length) throw new Error(`Faltan variables DB: ${missing.join(', ')}`);
  if (env.ADEIN_DB_TARGET !== 'local') throw new Error('ADEIN_DB_TARGET debe ser local');
  if (env.ADEIN_DB_HOST !== '127.0.0.1') throw new Error('ADEIN_DB_HOST debe ser 127.0.0.1');
  if (String(env.ADEIN_DB_PORT) !== '3307') throw new Error('ADEIN_DB_PORT debe ser 3307');
  if (env.ADEIN_DB_NAME !== 'adein_crm_dev') throw new Error('ADEIN_DB_NAME debe ser adein_crm_dev');
  // ADEIN_DB_USER debe existir; MariaDB valida la credencial real.

  return {
    host: env.ADEIN_DB_HOST,
    port: Number(env.ADEIN_DB_PORT),
    database: env.ADEIN_DB_NAME,
    user: env.ADEIN_DB_USER,
    password: env.ADEIN_DB_PASSWORD,
  };
}

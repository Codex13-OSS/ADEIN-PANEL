import mysql from 'mysql2/promise';

export const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];

export function loadDbConfig() {
  const missing = REQUIRED_DB_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    database: process.env.ADEIN_DB_NAME,
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD
  };
}

export async function createDbConnection(config) {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 8000
  });
}

export function maskDbError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? 'Unknown database error'
  };
}

#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { createLeadAgentApiServer } from './lib/adein-lead-agent-api.mjs';
import { loadLocalDbEnv, createMariaDbLeadRepository } from './lib/adein-lead-agent-store.mjs';
import { createPropertyMediaStore } from './lib/adein-property-media-store.mjs';
import { createWhatsappQueue } from './lib/adein-whatsapp-queue.mjs';
import { processQueueDirectory } from './lib/adein-deepseek-classifier.mjs';
import { buildLiaLaunchUrl, issueLiaHandoff, loadLiaHandoffSecret } from './lib/adein-lia-handoff.mjs';
import { bearerToken, issueOwnerSession, loadOwnerAuthConfig, verifyOwnerPassword, verifyOwnerSession } from './lib/adein-owner-auth.mjs';

const envFile = process.env.ADEIN_LOCAL_DB_ENV_FILE || `${process.env.HOME}/.agentes-si-data/adein/runtime/local-db.env`;
const host = process.env.LEAD_AGENT_LISTEN || '127.0.0.1';
const port = Number(process.env.LEAD_AGENT_PORT || 3192);
const liaSecretFile = process.env.ADEIN_LIA_HANDOFF_SECRET_FILE || `${process.env.HOME}/.agentes-si-data/adein/secrets/lia-handoff.secret`;
const liaBaseUrl = process.env.ADEIN_LIA_BASE_URL || '/lia';
const ownerAuthFile = process.env.ADEIN_OWNER_AUTH_FILE || `${process.env.HOME}/.agentes-si-data/adein/secrets/owner-auth.json`;
const mediaStore = createPropertyMediaStore({ rootDir: process.env.ADEIN_MEDIA_DIR || `${process.env.HOME}/.agentes-si-data/adein/media` });

let dbConfig;
try {
  dbConfig = loadLocalDbEnv(envFile);
  if (process.env.ADEIN_DB_HOST) dbConfig.host = process.env.ADEIN_DB_HOST;
  if (process.env.ADEIN_DB_PORT) {
    const portOverride = Number(process.env.ADEIN_DB_PORT);
    if (!Number.isInteger(portOverride) || portOverride < 1 || portOverride > 65535) {
      throw new Error('ADEIN_DB_PORT inválido');
    }
    dbConfig.port = portOverride;
  }
} catch (error) {
  if (process.env.ADEIN_LOCAL_DB_ENV_FILE) {
    throw new Error(`Configuración DB durable no disponible o inválida en ${envFile}: ${error.message}`);
  }

  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error(`Configuración DB no disponible: falta ${envFile} y DB_PASSWORD no está configurada`);
  }

  dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'adein_crm_dev',
    user: process.env.DB_USER || 'adein',
    password,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Códigos de error que indican pérdida/indisponibilidad de conexión con MariaDB.
const isConnectionLostError = (error) => {
  const code = String(error?.code || '');
  return (
    code === 'PROTOCOL_CONNECTION_LOST'
    || code === 'ECONNREFUSED'
    || code === 'ETIMEDOUT'
    || code === 'ENOTFOUND'
    || code === 'EHOSTUNREACH'
    || code === 'ER_SERVER_SHUTDOWN'
    || code === 'ER_CON_COUNT_ERROR'
    || code === 'EAI_AGAIN'
    || /Lost connection|Connection lost|closed state|Connection is closed|not connected/i.test(String(error?.message || ''))
  );
};

// Conexión con reintento: mientras la DB esté arrancando, se reintenta cada 3s.
// Errores de configuración (credenciales inválidas, etc.) se propagan de inmediato.
async function connectToDb(dbConfig) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const conn = await mysql.createConnection(dbConfig);
      // El socket puede morir; las queries fallan y withDb() se encarga de reconectar.
      conn.on('error', () => {});
      return conn;
    } catch (error) {
      const code = String(error?.code || '');
      const isAuthError = code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_BAD_DB_ERROR';
      if (isAuthError || attempt > 60) throw error;
      console.log(JSON.stringify({ ok: false, step: 'db-connect-retry', attempt, code, error: error.message }));
      await sleep(3000);
    }
  }
}

let connection = await connectToDb(dbConfig);
let repository = createMariaDbLeadRepository(connection);
const liaHandoffSecret = (await loadLiaHandoffSecret(liaSecretFile).catch(() => 'placeholder'));
const ownerAuthConfig = await loadOwnerAuthConfig(ownerAuthFile).catch(() => null);

const ownerAuth = ownerAuthConfig ? {
  login: async ({ username, password }) => {
    if (!verifyOwnerPassword(ownerAuthConfig, username, password)) return null;

    return {
      username: ownerAuthConfig.username,
      role: 'owner',
      token: issueOwnerSession(ownerAuthConfig, ownerAuthConfig.username),
    };
  },

  verifyRequest: async (req) =>
    verifyOwnerSession(ownerAuthConfig, bearerToken(req)),
} : null;

// Reintento automático: si la conexión a MariaDB se pierde, se recrea (intento
// rápido, sin bloquear el request) y la operación se reintenta una vez.
// El proceso nunca muere por caídas de DB y se recupera cuando la DB vuelve.
async function reconnectOnce() {
  try { await connection.destroy(); } catch { /* ya muerta */ }
  connection = await mysql.createConnection(dbConfig);
  connection.on('error', () => {});
  repository = createMariaDbLeadRepository(connection);
}

async function withDb(operation) {
  try {
    return await operation();
  } catch (error) {
    if (isConnectionLostError(error)) {
      await reconnectOnce();
      return await operation();
    }
    throw error;
  }
}

const whatsappQueueDir = process.env.LEAD_AGENT_QUEUE_DIR || '/tmp/adein-whatsapp/entrada';
const whatsappProcessedDir = process.env.LEAD_AGENT_PROCESSED_DIR || '/tmp/adein-whatsapp/procesados';

const server = createLeadAgentApiServer({
  ownerAuth,
  saveIngestion: (input) => withDb(() => repository.saveIngestion(input)),
  listLeads: () => withDb(() => repository.listLeads()),
  listAppointments: () => withDb(() => repository.listAppointments()),
  listProperties: () => withDb(() => repository.listProperties()),
  createProperty: (input) => withDb(() => repository.createProperty(input)),
  updateProperty: (input) => withDb(() => repository.updateProperty(input)),
  listLots: (propertyId) => withDb(() => repository.listLots(propertyId)),
  createLot: (input) => withDb(() => repository.createLot(input)),
  updateLot: (input) => withDb(() => repository.updateLot(input)),
  getPropertyListing: (propertyId) => withDb(() => repository.getPropertyListing(propertyId)),
  createPropertyListing: (input) => withDb(() => repository.createPropertyListing(input)),
  updatePropertyListing: (input) => withDb(() => repository.updatePropertyListing(input)),
  addPropertyListingFeature: (input) => withDb(() => repository.addPropertyListingFeature(input)),
  updatePropertyListingFeature: (input) => withDb(() => repository.updatePropertyListingFeature(input)),
  reorderPropertyListingFeatures: (input) => withDb(() => repository.reorderPropertyListingFeatures(input)),
  deletePropertyListingFeature: (input) => withDb(() => repository.deletePropertyListingFeature(input)),
  addPropertyListingImage: (input) => withDb(() => repository.addPropertyListingImage(input)),
  setPropertyListingImageCover: (input) => withDb(() => repository.setPropertyListingImageCover(input)),
  reorderPropertyListingImages: (input) => withDb(() => repository.reorderPropertyListingImages(input)),
  deletePropertyListingImage: (input) => withDb(() => repository.deletePropertyListingImage(input)),
  getPublicListingImage: (storageKey) => withDb(() => repository.getPublicListingImage(storageKey)),
  mediaStore,
  listPublicListings: () => withDb(() => repository.listPublicListings()),
  getLeadByPhone: (phone) => withDb(() => repository.getLeadByPhone(phone)),
  getLeadInventoryInterest: (leadId) => withDb(() => repository.getLeadInventoryInterest(leadId)),
  updateLeadInventoryInterest: (input) => withDb(() => repository.updateLeadInventoryInterest(input)),
  getAnalysisHistory: (leadId) => withDb(() => repository.getAnalysisHistory(leadId)),
  queueTxt: createWhatsappQueue(whatsappQueueDir),
  triggerImmediateAnalysis: async ({ sourceRef }) => {
    const result = await processQueueDirectory(whatsappQueueDir, whatsappProcessedDir, {
      saveIngestion: (record) => withDb(() => repository.saveIngestion(record)),
      getLeadByPhone: (phone) => withDb(() => repository.getLeadByPhone(phone)),
    });
    return result;
  },
  saveAppointment: (input) => withDb(() => repository.saveAppointment(input)),
  saveReminder: (input) => withDb(() => repository.saveReminder(input)),
  completeAppointment: (input) => withDb(() => repository.completeAppointment(input)),
  issueLiaHandoff: async () => buildLiaLaunchUrl({
    liaBaseUrl,
    token: issueLiaHandoff({ secret: liaHandoffSecret }).token,
  }),
});

const shutdown = async () => {
  await new Promise((resolve) => server.close(resolve));
  await connection.end();
  process.exit(0);
};

server.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, service: 'adein-lead-agent-api', host, port, database: 'adein_crm_dev', autonomous: true }));
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

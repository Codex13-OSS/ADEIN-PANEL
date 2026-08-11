import http from 'node:http';
import { buildLeadIngestionRecord } from './adein-lead-agent-contract.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

// CORS: aceptar orígenes locales de desarrollo (127.0.0.1:517x / localhost:517x)
// incluye previews de worktrees (5174+) generados por LÍA O.S.
const isLocalDevOrigin = (origin) => {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') return false;
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    const p = Number(port);
    return p >= 5170 && p <= 5199;
  } catch { return false; }
};

const json = (res, statusCode, body, req) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const origin = req?.headers?.origin;
  if (isLocalDevOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  else headers['Access-Control-Allow-Origin'] = 'http://127.0.0.1:5173';
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(body));
};

const readJson = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('Cuerpo demasiado grande'));
  });
  req.on('end', () => {
    try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON inválido')); }
  });
  req.on('error', reject);
});

export function createLeadAgentApiServer({
  saveIngestion,
  listLeads = async () => [],
  listAppointments = async () => [],
  getLeadByPhone = async () => null,
  getAnalysisHistory = async () => [],
  queueTxt = async () => { throw new Error('Cola de archivos no configurada'); },
  triggerImmediateAnalysis = async () => {},
  saveAppointment = async () => { throw new Error('Citas no configuradas'); },
  saveReminder = async () => { throw new Error('Recordatorios no configurados'); },
  completeAppointment = async () => { throw new Error('Citas no configuradas'); },
  issueLiaHandoff = async () => { throw new Error('Enlace LIA no configurado'); },
}) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {}, req);
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, service: 'adein-lead-agent-api', localOnly: true }, req);
    }
    if (req.method === 'GET' && req.url === '/api/local/lead-agent/leads') {
      return json(res, 200, { ok: true, leads: await listLeads() }, req);
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/local/lead-agent/leads/') && req.url.endsWith('/history')) {
      const leadId = req.url.split('/')[6];
      return json(res, 200, { ok: true, history: await getAnalysisHistory(leadId) }, req);
    }
    if (req.method === 'GET' && req.url === '/api/local/lead-agent/appointments') {
      return json(res, 200, { ok: true, appointments: await listAppointments() }, req);
    }
    if (req.method === 'GET' && req.url === '/api/local/lia/handoff') {
      try {
        return json(res, 200, { ok: true, launchUrl: await issueLiaHandoff() }, req);
      } catch (error) {
        return json(res, 503, { ok: false, error: error.message }, req);
      }
    }
    if (req.method === 'POST' && req.url === '/api/local/lead-agent/queue') {
      try {
        const input = await readJson(req);
        const queued = await queueTxt({ fileName: input.fileName, content: input.content });
        await triggerImmediateAnalysis({ sourceRef: queued.sourceRef });
        return json(res, 202, { ok: true, sourceRef: queued.sourceRef, analysisStarted: true }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }
    const leadAction = req.url?.match(/^\/api\/local\/lead-agent\/leads\/([^/]+)\/(appointment|reminder)$/);
    if (req.method === 'POST' && leadAction) {
      try {
        const input = await readJson(req);
        const leadId = leadAction[1];
        if (leadAction[2] === 'appointment') return json(res, 201, await saveAppointment({ leadId, buyerName: input.buyerName, date: input.date, time: input.time }), req);
        return json(res, 201, await saveReminder({ leadId, days: input.days }), req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }
    const completionRoute = req.url?.match(/^\/api\/local\/lead-agent\/appointments\/([^/]+)\/complete$/);
    if (req.method === 'POST' && completionRoute) {
      try {
        return json(res, 200, await completeAppointment({ appointmentId: completionRoute[1] }), req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }
    if (req.method !== 'POST' || req.url !== '/api/local/lead-agent/ingestions') {
      return json(res, 405, { ok: false, error: 'Method Not Allowed' }, req);
    }

    try {
      const input = await readJson(req);
      const record = buildLeadIngestionRecord(input);
      const saved = await saveIngestion(record);
      return json(res, 201, { ok: true, leadId: saved.leadId, action: saved.action, sourceRef: record.sourceRef }, req);
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message }, req);
    }
  });
}

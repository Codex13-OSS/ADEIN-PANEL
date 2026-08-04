import http from 'node:http';
import { buildLeadIngestionRecord } from './adein-lead-agent-contract.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

const json = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
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
  queueTxt = async () => { throw new Error('Cola de archivos no configurada'); },
  triggerImmediateAnalysis = async () => {},
  saveAppointment = async () => { throw new Error('Citas no configuradas'); },
  saveReminder = async () => { throw new Error('Recordatorios no configurados'); },
  issueLiaHandoff = async () => { throw new Error('Enlace LIA no configurado'); },
}) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, service: 'adein-lead-agent-api', localOnly: true });
    }
    if (req.method === 'GET' && req.url === '/api/local/lead-agent/leads') {
      return json(res, 200, { ok: true, leads: await listLeads() });
    }
    if (req.method === 'GET' && req.url === '/api/local/lia/handoff') {
      try {
        return json(res, 200, { ok: true, launchUrl: await issueLiaHandoff() });
      } catch (error) {
        return json(res, 503, { ok: false, error: error.message });
      }
    }
    if (req.method === 'POST' && req.url === '/api/local/lead-agent/queue') {
      try {
        const input = await readJson(req);
        const queued = await queueTxt({ fileName: input.fileName, content: input.content });
        await triggerImmediateAnalysis({ sourceRef: queued.sourceRef });
        return json(res, 202, { ok: true, sourceRef: queued.sourceRef, analysisStarted: true });
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message });
      }
    }
    const leadAction = req.url?.match(/^\/api\/local\/lead-agent\/leads\/([^/]+)\/(appointment|reminder)$/);
    if (req.method === 'POST' && leadAction) {
      try {
        const input = await readJson(req);
        const leadId = leadAction[1];
        if (leadAction[2] === 'appointment') return json(res, 201, await saveAppointment({ leadId, date: input.date, time: input.time }));
        return json(res, 201, await saveReminder({ leadId, days: input.days }));
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message });
      }
    }
    if (req.method !== 'POST' || req.url !== '/api/local/lead-agent/ingestions') {
      return json(res, 405, { ok: false, error: 'Method Not Allowed' });
    }

    try {
      const input = await readJson(req);
      const record = buildLeadIngestionRecord(input);
      const saved = await saveIngestion(record);
      return json(res, 201, { ok: true, leadId: saved.leadId, action: saved.action, sourceRef: record.sourceRef });
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message });
    }
  });
}

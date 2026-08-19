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
    return (p >= 5170 && p <= 5199) || (p >= 8000 && p <= 8099);
  } catch { return false; }
};

const json = (res, statusCode, body, req) => {
  const publicRoute = req?.url?.startsWith('/api/public/');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': publicRoute ? 'GET, HEAD, OPTIONS' : 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const origin = req?.headers?.origin;
  if (isLocalDevOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  else headers['Access-Control-Allow-Origin'] = 'http://127.0.0.1:5173';
  res.writeHead(statusCode, headers);
  res.end(req?.method === 'HEAD' ? undefined : JSON.stringify(body));
};

// Errores que indican indisponibilidad de la base de datos (503) vs errores de negocio (500).
const isDbUnavailableError = (error) => {
  const code = String(error?.code || '');
  return (
    code.startsWith('ER_')
    || code.startsWith('PROTOCOL_')
    || code === 'ECONNREFUSED'
    || code === 'ETIMEDOUT'
    || code === 'ENOTFOUND'
    || code === 'EHOSTUNREACH'
    || code === 'EAI_AGAIN'
    || /Lost connection|Connection lost|closed state|Connection is closed|not connected/i.test(String(error?.message || ''))
  );
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

const readMultipartImage = (req) => new Promise((resolve, reject) => {
  const boundary = String(req.headers['content-type'] || '').match(/boundary=([^;]+)/i)?.[1]?.replace(/^"|"$/g, '');
  if (!boundary) return reject(new Error('multipart/form-data requerido'));
  const chunks = []; let size = 0;
  req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BODY_BYTES) reject(new Error('Imagen demasiado grande')); else chunks.push(chunk); });
  req.on('end', () => {
    try {
      const marker = Buffer.from(`--${boundary}`); const body = Buffer.concat(chunks); const parts = [];
      for (let offset = body.indexOf(marker); offset >= 0;) { const start = offset + marker.length + 2; const next = body.indexOf(marker, start); if (next < 0) break; const part = body.subarray(start, next - 2); const split = part.indexOf(Buffer.from('\r\n\r\n')); if (split >= 0) parts.push({ headers: part.subarray(0, split).toString(), value: part.subarray(split + 4) }); offset = next; }
      const image = parts.find((part) => /name="image"/i.test(part.headers)); if (!image) throw new Error('Campo image requerido');
      const field = (name) => parts.find((part) => new RegExp(`name="${name}"`, 'i').test(part.headers))?.value.toString().trim() || '';
      resolve({ fileName: image.headers.match(/filename="([^"]+)"/i)?.[1] || '', contentType: image.headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '', buffer: image.value, altText: field('altText'), isCover: field('isCover') === 'true' });
    } catch (error) { reject(error); }
  });
  req.on('error', reject);
});

export function createLeadAgentApiServer({
  saveIngestion,
  listLeads = async () => [],
  listAppointments = async () => [],
  getLeadByPhone = async () => null,
  getLeadInventoryInterest = async () => { throw new Error('Interés de inventario no configurado'); },
  updateLeadInventoryInterest = async () => { throw new Error('Interés de inventario no configurado'); },
  getAnalysisHistory = async () => [],
  queueTxt = async () => { throw new Error('Cola de archivos no configurada'); },
  triggerImmediateAnalysis = async () => {},
  saveAppointment = async () => { throw new Error('Citas no configuradas'); },
  saveReminder = async () => { throw new Error('Recordatorios no configurados'); },
  completeAppointment = async () => { throw new Error('Citas no configuradas'); },
  issueLiaHandoff = async () => { throw new Error('Enlace LIA no configurado'); },
  ownerAuth = null,
  listProperties = async () => [],
  createProperty = async () => { throw new Error('Propiedades no configuradas'); },
  updateProperty = async () => { throw new Error('Propiedades no configuradas'); },
  listLots = async () => [],
  createLot = async () => { throw new Error('Lotes no configurados'); },
  updateLot = async () => { throw new Error('Lotes no configurados'); },
  getPropertyListing = async () => { throw new Error('Publicación no configurada'); },
  createPropertyListing = async () => { throw new Error('Publicación no configurada'); },
  updatePropertyListing = async () => { throw new Error('Publicación no configurada'); },
  addPropertyListingFeature = async () => { throw new Error('Publicación no configurada'); },
  updatePropertyListingFeature = async () => { throw new Error('Publicación no configurada'); },
  reorderPropertyListingFeatures = async () => { throw new Error('Publicación no configurada'); },
  deletePropertyListingFeature = async () => { throw new Error('Publicación no configurada'); },
  addPropertyListingImage = async () => { throw new Error('Publicación no configurada'); },
  setPropertyListingImageCover = async () => { throw new Error('Publicación no configurada'); },
  reorderPropertyListingImages = async () => { throw new Error('Publicación no configurada'); },
  deletePropertyListingImage = async () => { throw new Error('Publicación no configurada'); },
  getPublicListingImage = async () => null,
  mediaStore = null,
  listPublicListings = async () => [],
}) {
  const handleRequest = async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {}, req);
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, service: 'adein-lead-agent-api', localOnly: true }, req);
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && req.url === '/api/public/listings') {
      try {
        return json(res, 200, { ok: true, listings: await listPublicListings() }, req);
      } catch (error) {
        return json(res, isDbUnavailableError(error) ? 503 : 500, { ok: false, error: 'Catálogo público no disponible' }, req);
      }
    }
    const publicMediaRoute = req.url?.match(/^\/api\/public\/media\/(.+)$/);
    if ((req.method === 'GET' || req.method === 'HEAD') && publicMediaRoute) {
      try {
        const storageKey = decodeURIComponent(publicMediaRoute[1]);
        const metadata = await getPublicListingImage(storageKey);
        if (!metadata || !mediaStore) throw new Error('No encontrada');
        const { buffer } = await mediaStore.readPublic(storageKey);
        res.writeHead(200, { 'Content-Type': metadata.content_type || 'application/octet-stream', 'Content-Length': buffer.length, 'Cache-Control': 'public, max-age=31536000, immutable', ...(metadata.checksum_sha256 ? { ETag: `"${metadata.checksum_sha256}"` } : {}) });
        return req.method === 'HEAD' ? res.end() : res.end(buffer);
      } catch { return json(res, 404, { ok: false, error: 'Imagen no encontrada' }, req); }
    }
    if (req.method === 'POST' && req.url === '/api/local/auth/login') {
      try {
        if (!ownerAuth) {
          return json(res, 503, { ok: false, error: 'Owner auth no configurado' }, req);
        }

        const input = await readJson(req);
        const session = await ownerAuth.login({
          username: input.username,
          password: input.password,
        });

        if (!session) {
          return json(res, 401, { ok: false, error: 'Credenciales inválidas' }, req);
        }

        return json(res, 200, { ok: true, ...session }, req);
      } catch {
        return json(res, 401, { ok: false, error: 'Credenciales inválidas' }, req);
      }
    }

    if (req.method === 'GET' && req.url === '/api/local/auth/session') {
      if (!ownerAuth) {
        return json(res, 503, { ok: false, error: 'Owner auth no configurado' }, req);
      }

      const session = await ownerAuth.verifyRequest(req);

      if (!session) {
        return json(res, 401, { ok: false, error: 'Sesión inválida' }, req);
      }

      return json(res, 200, { ok: true, ...session }, req);
    }

    const requireOwner = async () => {
      if (!ownerAuth) {
        json(res, 503, { ok: false, error: 'Owner auth no configurado' }, req);
        return null;
      }

      const session = await ownerAuth.verifyRequest(req);

      if (!session || session.role !== 'owner') {
        json(res, 401, { ok: false, error: 'Sesión owner requerida' }, req);
        return null;
      }

      return session;
    };

    if (req.method === 'GET' && req.url === '/api/local/properties') {
      const session = await requireOwner();
      if (!session) return;
      return json(res, 200, { ok: true, properties: await listProperties() }, req);
    }

    if (req.method === 'POST' && req.url === '/api/local/properties') {
      const session = await requireOwner();
      if (!session) return;

      try {
        const input = await readJson(req);
        const property = await createProperty(input);
        return json(res, 201, { ok: true, property }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }

    const propertyRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)$/);

    if (req.method === 'PATCH' && propertyRoute) {
      const session = await requireOwner();
      if (!session) return;

      try {
        const input = await readJson(req);
        const property = await updateProperty({
          propertyId: propertyRoute[1],
          ...input,
        });
        return json(res, 200, { ok: true, property }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }

    const propertyLotsRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)\/lots$/);

    if (req.method === 'GET' && propertyLotsRoute) {
      const session = await requireOwner();
      if (!session) return;

      try {
        const lots = await listLots(propertyLotsRoute[1]);
        return json(res, 200, { ok: true, lots }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }

    if (req.method === 'POST' && propertyLotsRoute) {
      const session = await requireOwner();
      if (!session) return;

      try {
        const input = await readJson(req);
        const lot = await createLot({
          propertyId: propertyLotsRoute[1],
          ...input,
        });
        return json(res, 201, { ok: true, lot }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }

    const propertyLotRoute = req.url?.match(
      /^\/api\/local\/properties\/(\d+)\/lots\/(\d+)$/,
    );

    if (req.method === 'PATCH' && propertyLotRoute) {
      const session = await requireOwner();
      if (!session) return;

      try {
        const input = await readJson(req);
        const lot = await updateLot({
          propertyId: propertyLotRoute[1],
          lotId: propertyLotRoute[2],
          ...input,
        });
        return json(res, 200, { ok: true, lot }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
    }

    const listingRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)\/listing(?:\/(features|images))?$/);
    if (listingRoute && ['GET', 'POST', 'PATCH'].includes(req.method || '')) {
      const session = await requireOwner(); if (!session) return;
      try {
        const propertyId = listingRoute[1]; const child = listingRoute[2];
        if (req.method === 'GET' && !child) return json(res, 200, { ok: true, listing: await getPropertyListing(propertyId) }, req);
        const input = await readJson(req);
        if (req.method === 'POST' && !child) return json(res, 201, { ok: true, listing: await createPropertyListing({ propertyId, ...input }) }, req);
        if (req.method === 'PATCH' && !child) return json(res, 200, { ok: true, listing: await updatePropertyListing({ propertyId, updates: input }) }, req);
        if (req.method === 'POST' && child === 'features') return json(res, 201, { ok: true, listing: await addPropertyListingFeature({ propertyId, input }) }, req);
        if (req.method === 'POST' && child === 'images') return json(res, 201, { ok: true, listing: await addPropertyListingImage({ propertyId, input }) }, req);
        return json(res, 405, { ok: false, error: 'Método no permitido' }, req);
      } catch (error) { return json(res, 400, { ok: false, error: error.message }, req); }
    }

    const listingFeatureRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)\/listing\/features\/(\d+)(?:\/(order))?$/);
    if (listingFeatureRoute && ['PATCH', 'DELETE'].includes(req.method || '')) {
      const session = await requireOwner(); if (!session) return;
      try {
        const propertyId = listingFeatureRoute[1]; const featureId = listingFeatureRoute[2]; const action = listingFeatureRoute[3];
        if (req.method === 'PATCH' && action === 'order') { const input = await readJson(req); return json(res, 200, { ok: true, listing: await reorderPropertyListingFeatures({ propertyId, featureIds: input.featureIds }) }, req); }
        if (req.method === 'PATCH' && !action) { const input = await readJson(req); return json(res, 200, { ok: true, listing: await updatePropertyListingFeature({ propertyId, featureId, input }) }, req); }
        if (req.method === 'DELETE' && !action) return json(res, 200, { ok: true, listing: await deletePropertyListingFeature({ propertyId, featureId }) }, req);
        return json(res, 405, { ok: false, error: 'Método no permitido' }, req);
      } catch (error) { return json(res, 400, { ok: false, error: error.message }, req); }
    }

    const listingImageUploadRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)\/listing\/images\/upload$/);
    if (listingImageUploadRoute && req.method === 'POST') {
      const session = await requireOwner(); if (!session) return;
      try {
        if (!mediaStore) throw new Error('Almacenamiento de media no configurado');
        const input = await readMultipartImage(req); const listing = await getPropertyListing(listingImageUploadRoute[1]); if (!listing) throw new Error('Listing no encontrado');
        const saved = await mediaStore.saveUpload({ listingId: listing.id, ...input });
        try { return json(res, 201, { ok: true, listing: await addPropertyListingImage({ propertyId: listingImageUploadRoute[1], input: { ...saved, altText: input.altText, isCover: input.isCover } }) }, req); } catch (error) { await (await mediaStore.prepareDelete(saved.storageKey)).purge(); throw error; }
      } catch (error) { return json(res, 400, { ok: false, error: error.message }, req); }
    }
    const listingImageRoute = req.url?.match(/^\/api\/local\/properties\/(\d+)\/listing\/images\/(\d+)(?:\/(cover|order|content))?$/);
    if (listingImageRoute && ['GET', 'PATCH', 'DELETE'].includes(req.method || '')) {
      const session = await requireOwner(); if (!session) return;
      try {
        const propertyId = listingImageRoute[1]; const imageId = listingImageRoute[2]; const action = listingImageRoute[3];
        if (req.method === 'GET' && action === 'content') { const listing = await getPropertyListing(propertyId); const image = listing?.images.find((item) => item.id === imageId); if (!image || !mediaStore) throw new Error('Imagen no encontrada'); const { buffer } = await mediaStore.readPublic(image.storageKey); res.writeHead(200, { 'Content-Type': image.contentType || 'application/octet-stream', 'Content-Length': buffer.length, 'Cache-Control': 'private, no-cache' }); return res.end(buffer); }
        if (req.method === 'PATCH' && action === 'cover') return json(res, 200, { ok: true, listing: await setPropertyListingImageCover({ propertyId, imageId }) }, req);
        if (req.method === 'PATCH' && action === 'order') { const input = await readJson(req); return json(res, 200, { ok: true, listing: await reorderPropertyListingImages({ propertyId, imageIds: input.imageIds }) }, req); }
        if (req.method === 'DELETE' && !action) { const listing = await getPropertyListing(propertyId); const image = listing?.images.find((item) => item.id === imageId); if (!image || !mediaStore) throw new Error('Imagen no encontrada'); const pending = await mediaStore.prepareDelete(image.storageKey); try { await deletePropertyListingImage({ propertyId, imageId }); await pending.purge(); return json(res, 200, { ok: true }, req); } catch (error) { await pending.restore(); throw error; } }
        return json(res, 405, { ok: false, error: 'Método no permitido' }, req);
      } catch (error) { return json(res, 400, { ok: false, error: error.message }, req); }
    }

    if (req.method === 'GET' && req.url === '/api/local/lead-agent/leads') {
      return json(res, 200, { ok: true, leads: await listLeads() }, req);
    }
    const inventoryInterestRoute = req.url?.match(
      /^\/api\/local\/lead-agent\/leads\/(\d+)\/inventory-interest$/,
    );
    if (inventoryInterestRoute && (req.method === 'GET' || req.method === 'PATCH')) {
      const session = await requireOwner();
      if (!session) return;
      try {
        const leadId = inventoryInterestRoute[1];
        if (req.method === 'GET') {
          return json(res, 200, { ok: true, interest: await getLeadInventoryInterest(leadId) }, req);
        }
        const input = await readJson(req);
        return json(res, 200, {
          ok: true,
          interest: await updateLeadInventoryInterest({
            leadId,
            propertyId: input.propertyId,
            lotId: input.lotId,
          }),
        }, req);
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message }, req);
      }
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
        if (leadAction[2] === 'appointment') {
          if (!input.date) throw new Error('Fecha de cita requerida');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date))) throw new Error('Formato de fecha inválido (use YYYY-MM-DD)');
          const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/Mexico_City',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
          );
          const today = `${parts.year}-${parts.month}-${parts.day}`;
          if (input.date < today) throw new Error('No se pueden agendar citas en el pasado');
          return json(res, 201, await saveAppointment({ leadId, buyerName: input.buyerName, date: input.date, time: input.time }), req);
        }
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
  };

  // Red de seguridad: ningún error (p.ej. caída de DB) debe matar el proceso.
  // Se responde 503 (DB/upstream indisponible) o 500 y el servidor sigue vivo.
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      if (res.writableEnded) return;
      try {
        json(res, isDbUnavailableError(error) ? 503 : 500, { ok: false, error: 'Error interno del servicio', detail: error.message }, req);
      } catch {
        // Socket ya cerrado; no hay nada más que responder.
      }
    });
  });
}

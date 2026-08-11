import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLeadIngestionRecord } from './adein-lead-agent-contract.mjs';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_TIMEOUT_MS = parseInt(process.env.LEAD_AGENT_API_TIMEOUT || '120000', 10);

const SYSTEM_PROMPT = `Eres ADEIN Commercial Intelligence, clasificador inmobiliario profesional.

Analizas conversaciones de WhatsApp entre un asesor inmobiliario y un prospecto.

REGLAS DE PRIVACIDAD:
- NO cites textualmente la conversación en el summary.
- NO incluyas mensajes crudos en la respuesta.

REGLAS DE CLASIFICACIÓN COMERCIAL:

commercialStage (etapa comercial — NUNCA mezclar con estado de contacto):
- Nuevo: primer contacto, lead todavía no entendido.
- Contactado: ya hay conversación inicial pero faltan datos comerciales.
- Interesado: mostró interés real (precio, ubicación, financiamiento, medidas).
- Calificado: suficiente contexto para acción concreta (interés + capacidad + intención de avanzar).
- Cita agendada: hay fecha acordada explícita. NO inferir de "¿puedo visitar?".
- Cita realizada: visita confirmada como completada.
- Negociación: condiciones finales (descuento, apartado, forma de pago, documentos).
- Apartado: compromiso/apartado confirmado. NUNCA inventar pagos.
- Venta: operación cerrada confirmada.
- No interesado: rechazo explícito o sin interés claro.

contactState:
- Activo: conversación reciente, prospecto respondiendo.
- Esperando respuesta: nosotros preguntamos y no ha contestado.
- Sin respuesta: nunca respondió o dejó de responder hace tiempo.
- Pausado: el prospecto pidió pausa o no es momento.

priority: Alta | Media | Baja

nextActionType (tipo de siguiente acción):
RESPONDER | OBTENER_INFORMACION | ENVIAR_INFORMACION | AGENDAR_CITA
| CONFIRMAR_CITA | RECORDAR_CITA | SEGUIMIENTO | NEGOCIAR
| COMPLETAR_APARTADO | CERRAR | NINGUNA

detectedSignals: array de strings. Solo las REALMENTE detectadas.
Ejemplos: "preguntó precio", "definió ubicación", "indicó presupuesto",
"preguntó financiamiento", "solicitó visita", "confirmó cita",
"mencionó enganche", "preguntó mensualidades", "urgencia de compra"

missingInformation: array de strings. Solo lo que realmente falta.
Ejemplos: "nombre completo", "presupuesto", "forma de pago",
"horario de visita", "teléfono", "predio específico"

suggestedMessage: borrador de respuesta en español, natural, profesional.
NUNCA inventes precios, descuentos, promociones, disponibilidad ni condiciones.
NUNCA confirmes algo que el cliente no confirmó.
Si hay ambigüedad, pregunta o pide confirmación.

suggestedMessageReason: por qué se sugiere ese mensaje.

RESPONDE SOLO CON JSON VÁLIDO, sin markdown, sin explicaciones:
{
  "leads": [{
    "name": "Nombre o 'Por confirmar'",
    "phone": "solo dígitos o ''",
    "property": "nombre del predio o 'Por confirmar'",
    "budget": "presupuesto o 'Por confirmar'",
    "paymentPreference": "efectivo|crédito|mixto|mensualidades|'Por confirmar'",
    "priority": "Alta|Media|Baja",
    "commercialStage": "etapa comercial (ver arriba)",
    "contactState": "estado de contacto (ver arriba)",
    "summary": "resumen comercial breve, sin citas textuales",
    "stageReason": "por qué se asignó esta etapa comercial",
    "detectedSignals": ["señal1", "señal2"],
    "missingInformation": ["faltante1"],
    "nextAction": "descripción breve de la acción recomendada",
    "nextActionType": "RESPONDER|OBTENER_INFORMACION|...",
    "suggestedFollowupAt": "YYYY-MM-DD o fecha vacía ''",
    "suggestedMessage": "texto del borrador de respuesta",
    "suggestedMessageReason": "por qué este mensaje",
    "appointment": {"date":"YYYY-MM-DD","time":"HH:MM","property":"predio"} | null
  }]
}`;

async function fetchLeadContext(phoneNormalized, { getLeadByPhone }) {
  if (!phoneNormalized || !getLeadByPhone) return null;
  try {
    const existing = await getLeadByPhone(phoneNormalized);
    if (!existing) return null;
    return {
      id: existing.id,
      name: existing.name,
      property: existing.property_interest || existing.property,
      budget: existing.budget_text || existing.budget,
      priority: existing.priority,
      commercialStage: existing.commercial_stage || existing.status,
      contactState: existing.contact_state || 'Activo',
      summary: existing.summary,
      nextAction: existing.next_action,
    };
  } catch { return null; }
}

export async function classifyWhatsAppFile(filePath, { saveIngestion, getLeadByPhone }) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY no configurada. source ~/.agentes-si-data/adein/secrets/lead-agent.env');
  }

  // Extract phone from conversation and fetch existing context
  const phoneMatch = content.match(/(\d[\d\s-]{8,})/);
  let existingContext = null;
  if (phoneMatch && getLeadByPhone) {
    existingContext = await fetchLeadContext(
      phoneMatch[0].replace(/\D/g, '').slice(-10),
      { getLeadByPhone }
    );
  }

  const userContent = existingContext
    ? `CONTEXTO PREVIO DEL PROSPECTO (mismo teléfono, conversación anterior):\n${JSON.stringify(existingContext, null, 2)}\n\nNUEVA CONVERSACIÓN A ANALIZAR:\n\n${content.slice(0, 8000)}`
    : `Analiza esta conversación:\n\n${content.slice(0, 8000)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`DeepSeek API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('DeepSeek response vacía');

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed.leads || !Array.isArray(parsed.leads) || parsed.leads.length === 0) {
      throw new Error('Respuesta sin leads válidos');
    }

    const ALLOWED_STAGES = ['Nuevo','Contactado','Interesado','Calificado','Cita agendada','Cita realizada','Negociación','Apartado','Venta','No interesado'];
    const ALLOWED_CONTACT = ['Activo','Esperando respuesta','Sin respuesta','Pausado'];
    const ALLOWED_PRIORITY = ['Alta','Media','Baja'];

    const results = [];
    for (const lead of parsed.leads) {
      const commercialStage = ALLOWED_STAGES.includes(lead.commercialStage) ? lead.commercialStage : 'Nuevo';
      const contactState = ALLOWED_CONTACT.includes(lead.contactState) ? lead.contactState : 'Activo';
      const priority = ALLOWED_PRIORITY.includes(lead.priority) ? lead.priority : 'Media';

      const record = buildLeadIngestionRecord({
        sourceRef: fileName,
        decision: {
          name: lead.name || 'Por confirmar',
          phone: lead.phone || '',
          property: lead.property || 'Por confirmar',
          budget: lead.budget || 'Por confirmar',
          priority,
          status: commercialStage,
          summary: (lead.summary || '').slice(0, 500),
          nextAction: (lead.nextAction || 'Revisar conversación').slice(0, 255),
          appointment: lead.appointment && lead.appointment.date ? lead.appointment : null,
        },
      });

      // Attach expanded commercial data as metadata on the record
      record.meta = {
        commercialStage,
        contactState,
        stageReason: (lead.stageReason || '').slice(0, 500),
        detectedSignals: Array.isArray(lead.detectedSignals) ? lead.detectedSignals : [],
        missingInformation: Array.isArray(lead.missingInformation) ? lead.missingInformation : [],
        paymentPreference: (lead.paymentPreference || 'Por confirmar').slice(0, 160),
        nextActionType: lead.nextActionType || 'SEGUIMIENTO',
        suggestedMessage: (lead.suggestedMessage || '').slice(0, 1000),
        suggestedMessageReason: (lead.suggestedMessageReason || '').slice(0, 255),
        priorContext: existingContext,
      };

      const saved = await saveIngestion(record);
      results.push({ ...saved, meta: record.meta });
    }

    return { processed: results.length, leads: results };
  } finally {
    clearTimeout(timer);
  }
}

export async function processQueueDirectory(queueDir, processedDir, deps) {
  let entries;
  try { entries = await fs.readdir(queueDir); }
  catch { return { processed: 0, error: null }; }

  const txtFiles = entries.filter(f => f.endsWith('.txt'));
  if (txtFiles.length === 0) return { processed: 0, error: null };

  let processed = 0;
  let lastError = null;
  let allResults = [];

  for (const file of txtFiles) {
    const filePath = path.join(queueDir, file);
    try {
      const result = await classifyWhatsAppFile(filePath, deps);
      allResults = allResults.concat(result.leads);
      try {
        await fs.mkdir(processedDir, { recursive: true, mode: 0o700 });
        await fs.rename(filePath, path.join(processedDir, file));
      } catch {}
      processed++;
    } catch (e) {
      lastError = e.message;
    }
  }

  return { processed, error: lastError, results: allResults };
}

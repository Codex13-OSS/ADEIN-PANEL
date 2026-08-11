import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLeadIngestionRecord } from './adein-lead-agent-contract.mjs';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_TIMEOUT_MS = parseInt(process.env.LEAD_AGENT_API_TIMEOUT || '120000', 10);

const SYSTEM_PROMPT = `Eres un clasificador de leads inmobiliarios. Analizas conversaciones de WhatsApp.

Reglas:
1. Extrae solo datos comerciales: nombre, teléfono, predio, presupuesto, intención.
2. Clasifica prioridad: Alta (urgencia, precio, cita, compra), Media (interés sin urgencia), Baja (interés débil).
3. Clasifica estado: Nuevo, Contactado, Cita agendada, Venta, Descartado, Revisión manual.
4. Revisión manual: si falta contexto o teléfono. Descartado: spam, proveedores, empleo.
5. Si hay cita explícita, inclúyela.
6. NO cites textualmente la conversación. Solo datos estructurados.
7. Asigna todos a "Vendedor 1".

Responde SOLO con JSON válido, sin markdown, sin explicaciones:
{
  "leads": [
    {
      "name": "Nombre o 'Por confirmar'",
      "phone": "solo dígitos o ''",
      "property": "nombre del predio o 'Por confirmar'",
      "budget": "presupuesto o 'Por confirmar'",
      "priority": "Alta|Media|Baja",
      "status": "Nuevo|Contactado|Cita agendada|Venta|Descartado|Revisión manual",
      "summary": "resumen breve sin citas textuales",
      "nextAction": "siguiente acción sugerida",
      "appointment": {"date": "YYYY-MM-DD", "time": "HH:MM o ''", "property": "predio"} | null
    }
  ]
}`;

export async function classifyWhatsAppFile(filePath, { saveIngestion }) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY no configurada. source ~/.agentes-si-data/adein/secrets/lead-agent.env');
  }

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
          { role: 'user', content: `Analiza esta conversación de WhatsApp:\n\n${content.slice(0, 8000)}` },
        ],
        temperature: 0.1,
        max_tokens: 2000,
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

    // Parse JSON from response (may have markdown fences)
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed.leads || !Array.isArray(parsed.leads) || parsed.leads.length === 0) {
      throw new Error('Respuesta sin leads válidos');
    }

    const results = [];
    for (const lead of parsed.leads) {
      const record = buildLeadIngestionRecord({
        sourceRef: fileName,
        decision: {
          name: lead.name || 'Por confirmar',
          phone: lead.phone || '',
          property: lead.property || 'Por confirmar',
          budget: lead.budget || 'Por confirmar',
          priority: ['Alta', 'Media', 'Baja'].includes(lead.priority) ? lead.priority : 'Media',
          status: ['Nuevo', 'Contactado', 'Cita agendada', 'Venta', 'Descartado', 'Revisión manual'].includes(lead.status) ? lead.status : 'Revisión manual',
          summary: (lead.summary || '').slice(0, 500),
          nextAction: (lead.nextAction || '').slice(0, 255),
          appointment: lead.appointment && lead.appointment.date ? lead.appointment : null,
        },
      });

      const saved = await saveIngestion(record);
      results.push(saved);
    }

    return { processed: results.length, leads: results };
  } finally {
    clearTimeout(timer);
  }
}

// Process all pending files in the queue directory
export async function processQueueDirectory(queueDir, processedDir, deps) {
  let entries;
  try {
    entries = await fs.readdir(queueDir);
  } catch {
    return { processed: 0, error: null };
  }

  const txtFiles = entries.filter(f => f.endsWith('.txt'));
  if (txtFiles.length === 0) return { processed: 0, error: null };

  let processed = 0;
  let lastError = null;

  for (const file of txtFiles) {
    const filePath = path.join(queueDir, file);
    try {
      await classifyWhatsAppFile(filePath, deps);
      // Move to processed
      try {
        await fs.mkdir(processedDir, { recursive: true, mode: 0o700 });
        await fs.rename(filePath, path.join(processedDir, file));
      } catch {}
      processed++;
    } catch (e) {
      lastError = e.message;
      // Leave file in queue for retry
    }
  }

  return { processed, error: lastError };
}

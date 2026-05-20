import { AnalyzedConversation } from '../types/crm';

const NAME_EXCLUDE = ['adein', 'asesor', 'vendedor', 'sistema', 'admin', 'equipo'];
const INTENT_HIGH = ['comprar', 'apartar', 'visitar', 'cita', 'ubicación', 'ubicacion', 'precio', 'disponibilidad'];
const INTENT_MED = ['información', 'informacion', 'me interesa', 'detalles', 'quisiera saber', 'costos'];
const OBJECTION_TERMS = ['precio', 'ubicación', 'ubicacion', 'enganche', 'papeles', 'escrituras', 'mensualidades', 'confianza', 'tiempo'];
const PROPERTY_TERMS = ['predio', 'lote', 'terreno', 'parcela', 'hectárea', 'hectarea', 'm2', 'metros', 'norte', 'sur', 'ejido', 'financiamiento'];

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getTomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function parseWhatsAppConversation(rawText: string, fallback: AnalyzedConversation): AnalyzedConversation {
  const text = rawText.trim();
  if (!text || text.length < 10) return fallback;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return fallback;

  const participantCount = new Map<string, number>();
  for (const line of lines) {
    const match = line.match(/(?:\]|-\s)([^:]{2,40}):/);
    if (!match) continue;
    const name = match[1].trim();
    const key = normalize(name);
    if (NAME_EXCLUDE.some((term) => key.includes(term))) continue;
    participantCount.set(name, (participantCount.get(name) ?? 0) + 1);
  }

  const detectedName = [...participantCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback.name;

  const phoneMatch = text.match(/(?:\+?52[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4}[\s-]?\d{4}|(?:\+?52[\s-]?)?\d{10}/);
  const detectedPhone = phoneMatch?.[0]?.trim() || fallback.phone;

  const normalizedLines = lines.map((line) => normalize(line));
  const propertyLine = lines.find((_, index) => PROPERTY_TERMS.some((term) => normalize(normalizedLines[index]).includes(normalize(term))));
  const detectedProperty = propertyLine ? propertyLine.slice(0, 90) : fallback.property;

  const budgetMatch = text.match(/(?:\$\s?[\d,.]+\s?(?:mxn)?)|(?:\b\d+\s?mil\b)|(?:enganche[^\n.,]{0,35})|(?:mensualidad(?:es)?[^\n.,]{0,35})/i);
  const detectedBudget = budgetMatch?.[0]?.trim() || 'Por confirmar';

  const lowered = normalize(text);
  const highScore = INTENT_HIGH.filter((w) => lowered.includes(normalize(w))).length;
  const medScore = INTENT_MED.filter((w) => lowered.includes(normalize(w))).length;
  const hasQuestion = /\?/.test(text);

  const interestLevel: AnalyzedConversation['interestLevel'] = highScore >= 2 ? 'Alto' : (medScore > 0 || hasQuestion) ? 'Medio' : 'Bajo';
  const intention = interestLevel === 'Alto' ? 'Alta intención de compra detectada' : interestLevel === 'Medio' ? 'Solicita información para evaluar compra' : 'Contacto inicial, requiere calificación';
  const suggestedStatus = interestLevel === 'Alto' ? 'Interesado' : interestLevel === 'Medio' ? 'Interesado calificado' : 'Nuevo';
  const nextAction = interestLevel === 'Alto' ? 'Agendar llamada o visita al predio' : interestLevel === 'Medio' ? 'Enviar información y resolver dudas' : 'Enviar mensaje inicial de calificación';

  const objectionFound = OBJECTION_TERMS.filter((term) => lowered.includes(normalize(term)));
  const objections = objectionFound.length ? `Dudas detectadas: ${objectionFound.join(', ')}.` : 'Sin objeciones claras detectadas';

  const summary = `${detectedName} mostró interés ${interestLevel.toLowerCase()} en ${detectedProperty}. ${objections}`;
  const suggestedMessage = `Hola ${detectedName}, gracias por tu interés. Te comparto la información del predio/lote y podemos agendar una llamada o visita para resolver tus dudas.`;

  return {
    ...fallback,
    name: detectedName,
    phone: detectedPhone,
    property: detectedProperty,
    budget: detectedBudget,
    intention,
    objections,
    interestLevel,
    suggestedStatus,
    nextAction,
    suggestedFollowupDate: getTomorrow(),
    summary,
    suggestedMessage,
  };
}

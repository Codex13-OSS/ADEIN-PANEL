import { WHATSAPP_TXT_DEMO_V077_SOURCE } from '../fixtures/whatsappTxtDemoV077';

export type PreviewProspect = {
  name: string;
  interest: 'terreno' | 'lote';
  temperature: 'alta' | 'media' | 'baja';
  nextAction: string;
};

export type WhatsappTxtPreviewResult = {
  ok: boolean;
  source: typeof WHATSAPP_TXT_DEMO_V077_SOURCE;
  syntheticOnly: true;
  realDataUsed: false;
  messagesCount: number;
  participants: string[];
  previewProspects: PreviewProspect[];
  suggestedFollowups: string[];
  warnings: string[];
};

const messagePattern = /^\[(.*?)\]\s([^:]+):\s(.*)$/;

export function parseWhatsappTxtPreview(text: string): WhatsappTxtPreviewResult {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const participants = new Set<string>();
  const parsedMessages = lines
    .map((line) => {
      const match = line.match(messagePattern);
      if (!match) return null;
      const [, , sender, message] = match;
      const cleanSender = sender.trim();
      participants.add(cleanSender);
      return { sender: cleanSender, message: message.trim().toLowerCase() };
    })
    .filter((entry): entry is { sender: string; message: string } => Boolean(entry));

  const combinedText = parsedMessages.map((entry) => entry.message).join(' ');
  const hasStrongIntent = /precio|enganche|cita|agendar|esta semana/.test(combinedText);
  const hasInterest = /terreno|lote|cedros/.test(combinedText);

  return {
    ok: parsedMessages.length > 0,
    source: WHATSAPP_TXT_DEMO_V077_SOURCE,
    syntheticOnly: true,
    realDataUsed: false,
    messagesCount: parsedMessages.length,
    participants: [...participants],
    previewProspects: hasInterest
      ? [
          {
            name: 'Prospecto detectado',
            interest: combinedText.includes('lote') ? 'lote' : 'terreno',
            temperature: hasStrongIntent ? 'alta' : 'media',
            nextAction: hasStrongIntent
              ? 'Contactar hoy para confirmar cita y enviar opciones de terreno/lote.'
              : 'Dar seguimiento comercial en menos de 24 horas.',
          },
        ]
      : [],
    suggestedFollowups: hasStrongIntent
      ? ['Confirmar horario de cita por WhatsApp.', 'Enviar resumen comercial de opciones en Cedros.']
      : ['Solicitar mayor contexto de necesidad y presupuesto.'],
    warnings: [
      'Vista previa con conversación simulada.',
      'No se subió ningún archivo real.',
      'No se guardaron datos reales.',
    ],
  };
}

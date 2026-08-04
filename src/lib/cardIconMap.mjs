const rules = [
  [/cita/i, 'calendar'],
  [/atendido/i, 'check'],
  [/prospect|comprador/i, 'users'],
  [/prioridad|atender/i, 'alert'],
  [/revisión|revisar/i, 'review'],
  [/predio|negocio/i, 'property'],
];

export const iconForLabel = (label) => rules.find(([pattern]) => pattern.test(label))?.[1] ?? 'spark';

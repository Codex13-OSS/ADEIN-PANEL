export type Prospect = {
  id: string;
  name: string;
  phone: string;
  property: string;
  status: 'Nuevo' | 'Interesado' | 'Cita agendada' | 'No responde' | 'Interesado calificado';
  seller: string;
  lastContact: string;
  nextAction: string;
  intentionLevel: 'Alta' | 'Media' | 'Baja';
};

export type Followup = {
  id: string;
  prospectName: string;
  action: string;
  suggestedTime: string;
  priority: 'Alta' | 'Media' | 'Baja';
  state: 'Pendiente de hoy' | 'Vencido' | 'Próximo';
  completed: boolean;
};

export type AnalyzedConversation = {
  name: string;
  phone: string;
  property: string;
  budget: string;
  intention: string;
  objections: string;
  interestLevel: 'Alto' | 'Medio' | 'Bajo';
  suggestedStatus: Prospect['status'];
  nextAction: string;
  suggestedFollowupDate: string;
  summary: string;
  suggestedMessage: string;
};

export type RecommendedAction = {
  id: string;
  priority: 'Alta' | 'Media' | 'Baja';
  title: string;
  reason: string;
  suggestedAction: string;
};

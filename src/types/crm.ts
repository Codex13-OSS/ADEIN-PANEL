export type Prospect = {
  id: string;
  name: string;
  phone: string;
  property: string;
  status: 'Nuevo' | 'Contactado' | 'Interesado' | 'Cita agendada' | 'Venta' | 'Descartado' | 'Revisión manual' | 'No responde' | 'Interesado calificado';
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


export type CrmHistoryEvent = {
  id: string;
  type: 'prospect_created' | 'followup_created' | 'followup_completed' | 'whatsapp_analysis_saved';
  title: string;
  description: string;
  prospectName?: string;
  prospectPhone?: string;
  property?: string;
  createdAt: string;
  source: 'manual' | 'whatsapp_txt' | 'demo';
};

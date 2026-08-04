import { useEffect, useMemo, useState } from 'react';
import { Role } from './LoginView';
import Sidebar from './Sidebar';
import Header from './Header';
import OwnerDashboardPage from '../pages/OwnerDashboardPage';
import CrmPage from '../pages/CrmPage';
import CurrentBusinessPage from '../pages/CurrentBusinessPage';
import DocumentsPage from '../pages/DocumentsPage';

import { CrmTab } from '../pages/CrmPage';
import AdeinAnimatedBackground from './AdeinAnimatedBackground';
import { AnalyzedConversation, CrmHistoryEvent, Followup, Prospect, RecommendedAction } from '../types/crm';

import { buildFollowupReadinessCandidate, buildProspectReadinessCandidate, hasDuplicateProspectPhone } from '../lib/crmPipelineLocal';
import { DbSnapshotProvider } from '../context/DbSnapshotContext';

export type OwnerSection = 'dashboard' | 'crm' | 'business' | 'documents';
export type SellerSection = 'crm' | 'documents';

const crmTabBySection = { crm: 'prospectos' } as const;
const sectionByCrmTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'crm',
  seguimientos: 'crm',
  acciones: 'crm',
  historial: 'crm',
};

const MOCK_ANALYSIS: AnalyzedConversation = {
  name: 'Prospecto Cedros', phone: '555-0199', property: 'Predio Cedros', budget: '$680,000 MXN', intention: 'Compra en 30 días', objections: 'Tiempo de traslado',
  interestLevel: 'Alto', suggestedStatus: 'Interesado calificado', nextAction: 'Agendar visita guiada', suggestedFollowupDate: 'Hoy 5:30 PM',
  summary: 'Lead con alta disposición de cierre si se confirma acceso y ubicación.', suggestedMessage: 'Hola, con gusto puedo apoyarle con disponibilidad y ubicación del predio. ¿Le parece si agendamos una visita?',
};


type Props = {
  session: { role: Role; username: string };
  defaultSection: OwnerSection | SellerSection;
  onLogout: () => void;
};

function Shell({ session, defaultSection, onLogout }: Props) {
  const isSeller = session.role === 'seller';
  const initialCrmTab = defaultSection in crmTabBySection ? crmTabBySection[defaultSection as keyof typeof crmTabBySection] : 'prospectos';
  const [activeSection, setActiveSection] = useState<OwnerSection | SellerSection>(defaultSection);
  const [activeCrmTab, setActiveCrmTab] = useState<CrmTab>(initialCrmTab);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [historyEvents, setHistoryEvents] = useState<CrmHistoryEvent[]>([]);

  const recommendedActions = useMemo<RecommendedAction[]>(() => {
    const pendingFollowups = followups.filter((item) => !item.completed);
    const highIntention = prospects.filter((item) => item.intentionLevel === 'Alta');
    return [
      { id: 'action-high-intention', priority: 'Alta', title: 'Contactar interesados sin cita', reason: `${prospects.length} prospectos activos en CRM; ${highIntention.length} con intención alta.`, suggestedAction: 'Enviar propuesta de horario hoy.' },
      { id: 'action-pending-followup', priority: pendingFollowups.length > 3 ? 'Alta' : 'Media', title: 'Ejecutar seguimientos pendientes', reason: `${pendingFollowups.length} seguimientos pendientes requieren contacto esta jornada.`, suggestedAction: 'Priorizar vencidos y pendientes de hoy.' },
      { id: 'action-crm-hygiene', priority: 'Baja', title: 'Actualizar estatus del CRM', reason: 'Mantener estatus y notas al día mejora la conversión del equipo.', suggestedAction: 'Registrar cada contacto después del seguimiento.' },
    ];
  }, [followups, prospects]);


  useEffect(() => {
    let active = true;
    const refreshAgentLeads = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3192/api/local/lead-agent/leads');
        if (!response.ok) return;
        const payload = await response.json() as { ok?: boolean; leads?: Prospect[] };
        if (active && payload.ok && Array.isArray(payload.leads)) setProspects(payload.leads);
      } catch {
        // El CRM conserva su estado local si el puente del subagente no está activo.
      }
    };
    void refreshAgentLeads();
    const interval = window.setInterval(() => { void refreshAgentLeads(); }, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);



  const appendHistoryEvent = (event: Omit<CrmHistoryEvent, 'id' | 'createdAt'>) => {
    setHistoryEvents((previous) => [{
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...event,
    }, ...previous]);
  };
  const section = isSeller && activeSection !== 'documents' ? sectionByCrmTab[activeCrmTab] : activeSection;

  const handleSaveProspect = (analysis: AnalyzedConversation): 'created' | 'duplicate' => {
    const duplicate = hasDuplicateProspectPhone(prospects, analysis.phone);
    if (duplicate) return 'duplicate';

    const createdProspect = {
      id: `prospect-${Date.now()}`,
      name: analysis.name,
      phone: analysis.phone,
      property: analysis.property,
      status: analysis.suggestedStatus,
      seller: session.role === 'seller' ? session.username : 'Vendedor A',
      lastContact: 'Ahora',
      nextAction: analysis.nextAction,
      intentionLevel: analysis.interestLevel === 'Alto' ? 'Alta' : analysis.interestLevel === 'Medio' ? 'Media' : 'Baja',
    } as const;

    setProspects((previous) => [...previous, createdProspect]);

    appendHistoryEvent({
      type: 'prospect_created',
      title: 'Prospecto creado',
      description: `Se agregó a ${analysis.name} al CRM desde análisis de WhatsApp. Payload local listo para BD v063 (sin envío).`,
      prospectName: analysis.name,
      prospectPhone: analysis.phone,
      property: analysis.property,
      source: 'whatsapp_txt',
    });

    void buildProspectReadinessCandidate(createdProspect, analysis, 'whatsapp_txt');
    return 'created';
  };

  const handleCreateFollowup = (analysis: AnalyzedConversation): 'created' | 'duplicate' => {
    const duplicate = followups.some((item) => !item.completed && item.prospectName.toLowerCase() === analysis.name.toLowerCase() && item.action.toLowerCase() === analysis.nextAction.toLowerCase());
    if (duplicate) return 'duplicate';

    const createdFollowup = {
      id: `followup-${Date.now()}`,
      prospectName: analysis.name,
      action: analysis.nextAction,
      suggestedTime: analysis.suggestedFollowupDate,
      priority: analysis.interestLevel === 'Alto' ? 'Alta' : analysis.interestLevel === 'Medio' ? 'Media' : 'Baja',
      state: 'Pendiente de hoy',
      completed: false,
    } as const;

    setFollowups((previous) => [createdFollowup, ...previous]);

    appendHistoryEvent({
      type: 'followup_created',
      title: 'Seguimiento creado',
      description: `Se programó seguimiento para ${analysis.name}. Payload local listo para BD v063 (sin envío).`,
      prospectName: analysis.name,
      prospectPhone: analysis.phone,
      property: analysis.property,
      source: 'whatsapp_txt',
    });

    void buildFollowupReadinessCandidate(createdFollowup, session.username, 'whatsapp_txt');
    return 'created';
  };

  const handleCompleteFollowup = (id: string) => {
    const followup = followups.find((item) => item.id === id);
    if (!followup || followup.completed) return;

    setFollowups((previous) => previous.map((item) => item.id === id ? { ...item, completed: true } : item));
    appendHistoryEvent({
      type: 'followup_completed',
      title: 'Seguimiento completado',
      description: `Se marcó como realizado el seguimiento de ${followup.prospectName}.`,
      prospectName: followup.prospectName,
      source: 'manual',
    });
  };

  const handleResetCrmDemo = () => {
    if (typeof window !== 'undefined' && !window.confirm('¿Limpiar datos temporales de esta sesión?')) return;
    setProspects([]);
    setFollowups([]);
    setHistoryEvents([]);
  };

  void MOCK_ANALYSIS;
  void historyEvents;
  void recommendedActions;
  void handleSaveProspect;
  void handleCreateFollowup;
  void handleCompleteFollowup;
  void handleResetCrmDemo;

  const handleSectionChange = (nextSection: OwnerSection | SellerSection) => {
    if (!isSeller) {
      setActiveSection(nextSection);
      if (nextSection === 'crm') setActiveCrmTab('prospectos');
      return;
    }

    if (nextSection === 'documents') {
      setActiveSection('documents');
      return;
    }

    const mappedTab = crmTabBySection[nextSection as keyof typeof crmTabBySection];
    if (mappedTab) {
      setActiveSection('crm');
      setActiveCrmTab(mappedTab);
    }
  };
  const title = useMemo(() => ({
    dashboard: 'Dashboard maestro', crm: 'CRM ventas', business: 'Negocio actual',
    documents: 'Documentos',
  }[section]), [section]);

  const subtitle = useMemo(() => ({
    dashboard: 'Centro de decisiones comerciales del día', crm: 'Pipeline y operación comercial guiada', business: 'Estado operativo del predio actual',
    documents: 'Generador documental integrado',
  }[section]), [section]);

  const renderPage = () => {
    if (section === 'dashboard') return <OwnerDashboardPage prospects={prospects} />;
    if (section === 'crm') return <CrmPage activeTab={activeCrmTab} onTabChange={setActiveCrmTab} prospects={prospects} />;
    if (section === 'business') return <CurrentBusinessPage prospects={prospects} />;
    if (section === 'documents') return <DocumentsPage />;
    return <CrmPage activeTab={activeCrmTab} onTabChange={setActiveCrmTab} prospects={prospects} />;
  };

  return (
    <main className="app-shell">
      <AdeinAnimatedBackground variant="panel" />
      <Sidebar role={session.role} current={activeSection} activeCrmTab={activeCrmTab} onChange={handleSectionChange} />
      <section className="main-panel">
        <Header role={session.role} title={title} subtitle={subtitle} onLogout={onLogout} showLogout={section !== 'documents'} />
        <DbSnapshotProvider>{renderPage()}</DbSnapshotProvider>
      </section>
    </main>
  );
}

export default Shell;

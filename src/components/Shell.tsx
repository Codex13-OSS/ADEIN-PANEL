import { useEffect, useMemo, useState } from 'react';
import { Role } from './LoginView';
import Sidebar from './Sidebar';
import Header from './Header';
import OwnerDashboardPage from '../pages/OwnerDashboardPage';
import CrmPage from '../pages/CrmPage';
import CurrentBusinessPage from '../pages/CurrentBusinessPage';
import CampaignsPage from '../pages/CampaignsPage';
import SellersPage from '../pages/SellersPage';
import DocumentsPage from '../pages/DocumentsPage';
import SettingsPage from '../pages/SettingsPage';
import { getHistoricalMetrics } from '../lib/historicalMetrics';
import { CrmTab } from '../pages/CrmPage';
import AdeinAnimatedBackground from './AdeinAnimatedBackground';
import { AnalyzedConversation, CrmHistoryEvent, Followup, Prospect, RecommendedAction } from '../types/crm';
import { clearCrmStorage, loadCrmStorage, saveCrmStorage } from '../lib/crmStorage';
import { buildFollowupReadinessCandidate, buildProspectReadinessCandidate, hasDuplicateProspectPhone } from '../lib/crmPipelineLocal';
import { DbSnapshotProvider } from '../context/DbSnapshotContext';

export type OwnerSection = 'dashboard' | 'crm' | 'business' | 'campaigns' | 'sellers' | 'documents' | 'settings';
export type SellerSection = 'crm' | 'analyze' | 'followups' | 'performance' | 'documents';

const crmTabBySection = { crm: 'prospectos', analyze: 'whatsapp', followups: 'seguimientos', performance: 'acciones' } as const;
const sectionByCrmTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'analyze',
  seguimientos: 'followups',
  acciones: 'performance',
  historial: 'crm',
};

const MOCK_ANALYSIS: AnalyzedConversation = {
  name: 'Prospecto Cedros', phone: '555-0199', property: 'Predio Cedros', budget: '$680,000 MXN', intention: 'Compra en 30 días', objections: 'Tiempo de traslado',
  interestLevel: 'Alto', suggestedStatus: 'Interesado calificado', nextAction: 'Agendar visita guiada', suggestedFollowupDate: 'Hoy 5:30 PM',
  summary: 'Lead con alta disposición de cierre si se confirma acceso y ubicación.', suggestedMessage: 'Hola, con gusto puedo apoyarle con disponibilidad y ubicación del predio. ¿Le parece si agendamos una visita?',
};

const INITIAL_PROSPECTS: Prospect[] = [
  { id: 'prospect-horizonte', name: 'Prospecto Horizonte', phone: '555-0101', property: 'Predio Norte', status: 'Interesado', seller: 'Vendedor A', lastContact: 'Hoy 10:30', nextAction: 'Enviar ubicación', intentionLevel: 'Alta' },
  { id: 'prospect-alameda', name: 'Prospecto Alameda', phone: '555-0102', property: 'Predio Sur', status: 'Cita agendada', seller: 'Vendedor B', lastContact: 'Ayer 17:15', nextAction: 'Confirmar visita', intentionLevel: 'Media' },
];

const INITIAL_FOLLOWUPS: Followup[] = [
  { id: 'followup-horizonte', state: 'Pendiente de hoy', prospectName: 'Prospecto Horizonte', action: 'Enviar ubicación y rango de precios', suggestedTime: '11:30 AM', priority: 'Alta', completed: false },
  { id: 'followup-alameda', state: 'Vencido', prospectName: 'Prospecto Alameda', action: 'Confirmar visita programada', suggestedTime: 'Ayer 6:00 PM', priority: 'Alta', completed: false },
  { id: 'followup-bosques', state: 'Próximo', prospectName: 'Prospecto Bosques', action: 'Llamada de validación de presupuesto', suggestedTime: 'Mañana 10:00 AM', priority: 'Media', completed: false },
];

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
  const [crmState] = useState(() => loadCrmStorage({ prospects: INITIAL_PROSPECTS, followups: INITIAL_FOLLOWUPS, historyEvents: [] }));
  const [prospects, setProspects] = useState<Prospect[]>(crmState.prospects);
  const [followups, setFollowups] = useState<Followup[]>(crmState.followups);
  const [historyEvents, setHistoryEvents] = useState<CrmHistoryEvent[]>(crmState.historyEvents);

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
    saveCrmStorage({ prospects, followups, historyEvents });
  }, [prospects, followups, historyEvents]);



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
    if (typeof window !== 'undefined' && !window.confirm('¿Restablecer CRM demo a datos iniciales?')) return;
    clearCrmStorage();
    setProspects(INITIAL_PROSPECTS);
    setFollowups(INITIAL_FOLLOWUPS);
    setHistoryEvents([]);
  };

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
    dashboard: 'Dashboard maestro', crm: 'CRM ventas', business: 'Negocio actual', campaigns: 'Campañas', sellers: 'Vendedores',
    documents: 'Documentos', settings: 'Configuración', analyze: 'Analizar WhatsApp', followups: 'Mis seguimientos', performance: 'Acciones recomendadas',
  }[section]), [section]);

  const subtitle = useMemo(() => ({
    dashboard: 'Centro de decisiones comerciales del día', crm: 'Pipeline y operación comercial guiada', business: 'Estado operativo del predio actual',
    campaigns: 'Monitoreo visual de campañas activas', sellers: 'Gestión de equipo comercial', documents: 'Plataforma documental separada',
    settings: 'Parámetros generales del panel', analyze: 'Extracción comercial mock desde conversaciones', followups: 'Agenda de acciones por prioridad',
    performance: 'Recomendaciones ejecutivas para vendedores',
  }[section]), [section]);

  const historicalMetrics = useMemo(() => getHistoricalMetrics(), []);

  const renderPage = () => {
    if (section === 'dashboard') return <OwnerDashboardPage prospects={prospects} followups={followups} recommendedActions={recommendedActions} historicalMetrics={historicalMetrics} onOpenWhatsAppAnalysis={() => { setActiveSection('crm'); setActiveCrmTab('whatsapp'); }} />;
    if (section === 'crm' || section === 'analyze' || section === 'followups' || section === 'performance') return <CrmPage role={session.role} activeTab={activeCrmTab} onTabChange={setActiveCrmTab} prospects={prospects} followups={followups} historyEvents={historyEvents} recommendedActions={recommendedActions} analyzedConversation={MOCK_ANALYSIS} onSaveProspect={handleSaveProspect} onCreateFollowup={handleCreateFollowup} onCompleteFollowup={handleCompleteFollowup} onResetCrmDemo={handleResetCrmDemo} />;
    if (section === 'business') return <CurrentBusinessPage historicalMetrics={historicalMetrics} />;
    if (section === 'campaigns') return <CampaignsPage historicalMetrics={historicalMetrics} />;
    if (section === 'sellers') return <SellersPage historicalMetrics={historicalMetrics} />;
    if (section === 'documents') return <DocumentsPage />;
    return <SettingsPage />;
  };

  return (
    <main className="app-shell">
      <AdeinAnimatedBackground variant="panel" />
      <Sidebar role={session.role} current={activeSection} activeCrmTab={activeCrmTab} onChange={handleSectionChange} />
      <section className="main-panel">
        <Header role={session.role} title={title} subtitle={subtitle} username={session.username} onLogout={onLogout} />
        <DbSnapshotProvider>{renderPage()}</DbSnapshotProvider>
      </section>
    </main>
  );
}

export default Shell;

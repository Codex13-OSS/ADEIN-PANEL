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
import { Prospect } from '../types/crm';
import { DbSnapshotProvider } from '../context/DbSnapshotContext';

export type OwnerSection = 'dashboard' | 'crm' | 'business' | 'documents';
export type SellerSection = 'crm' | 'documents';

const crmTabBySection = { crm: 'prospectos' } as const;
const sectionByCrmTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'crm',
  appointments: 'crm',
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);



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



  const section = isSeller && activeSection !== 'documents' ? sectionByCrmTab[activeCrmTab] : activeSection;

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
    if (section === 'crm') return <CrmPage activeTab={activeCrmTab} onTabChange={setActiveCrmTab} prospects={prospects} onProspectsLoaded={setProspects} />;
    if (section === 'business') return <CurrentBusinessPage prospects={prospects} />;
    if (section === 'documents') return <DocumentsPage />;
    return <CrmPage activeTab={activeCrmTab} onTabChange={setActiveCrmTab} prospects={prospects} onProspectsLoaded={setProspects} />;
  };

  return (
    <main className="app-shell">
      <AdeinAnimatedBackground variant="panel" />
      <Sidebar role={session.role} current={activeSection} activeCrmTab={activeCrmTab} onChange={handleSectionChange} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      <section className="main-panel">
        <Header role={session.role} title={title} subtitle={subtitle} onLogout={onLogout} showLogout={section !== 'documents'} />
        <DbSnapshotProvider>{renderPage()}</DbSnapshotProvider>
      </section>
    </main>
  );
}

export default Shell;

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
import { LEAD_AGENT_API } from '../lib/runtimeConfig';

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
        const response = await fetch(`${LEAD_AGENT_API}/leads`);
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
    dashboard: 'Inicio', crm: 'Ventas', business: 'Mi negocio',
    documents: 'Documentos',
  }[section]), [section]);

  const subtitle = useMemo(() => ({
    dashboard: 'Lo más importante hoy', crm: 'Prospectos, citas y conversaciones', business: 'Cómo va tu operación',
    documents: 'Contratos y pagarés',
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
      {/* Mobile Navigation */}
      <nav className="mobile-nav">
        <div className="mobile-nav-brand">
          <img src="/brand/adein.png" alt="ADEIN" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span>{title}</span>
        </div>
        <div className="mobile-nav-links">
          <button className={section === 'dashboard' ? 'active' : ''} onClick={() => handleSectionChange('dashboard')}>Inicio</button>
          <button className={section === 'crm' ? 'active' : ''} onClick={() => handleSectionChange('crm')}>Ventas</button>
          <button className={section === 'business' ? 'active' : ''} onClick={() => handleSectionChange('business')}>Negocio</button>
          <button className={section === 'documents' ? 'active' : ''} onClick={() => handleSectionChange('documents')}>Docs</button>
          <button onClick={onLogout}>Salir</button>
        </div>
      </nav>
      <Sidebar role={session.role} current={activeSection} activeCrmTab={activeCrmTab} onChange={handleSectionChange} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      <section className="main-panel">
        <Header role={session.role} title={title} subtitle={subtitle} onLogout={onLogout} showLogout={section !== 'documents'} />
        <DbSnapshotProvider>{renderPage()}</DbSnapshotProvider>
      </section>
    </main>
  );
}

export default Shell;

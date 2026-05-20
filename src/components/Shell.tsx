import { useMemo, useState } from 'react';
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

export type OwnerSection = 'dashboard' | 'crm' | 'business' | 'campaigns' | 'sellers' | 'documents' | 'settings';
export type SellerSection = 'crm' | 'analyze' | 'followups' | 'performance' | 'documents';

type Props = {
  session: { role: Role; username: string };
  defaultSection: OwnerSection | SellerSection;
  onLogout: () => void;
};

function Shell({ session, defaultSection, onLogout }: Props) {
  const [section, setSection] = useState(defaultSection);
  const title = useMemo(() => ({
    dashboard: 'Dashboard maestro', crm: 'CRM ventas', business: 'Negocio actual', campaigns: 'Campañas', sellers: 'Vendedores',
    documents: 'Documentos', settings: 'Configuración', analyze: 'Analizar conversación', followups: 'Mis seguimientos', performance: 'Mi desempeño',
  }[section]), [section]);

  const renderPage = () => {
    if (section === 'dashboard') return <OwnerDashboardPage />;
    if (section === 'crm' || section === 'analyze' || section === 'followups' || section === 'performance') return <CrmPage />;
    if (section === 'business') return <CurrentBusinessPage />;
    if (section === 'campaigns') return <CampaignsPage />;
    if (section === 'sellers') return <SellersPage />;
    if (section === 'documents') return <DocumentsPage />;
    return <SettingsPage />;
  };

  return (
    <main className="app-shell technical-bg">
      <Sidebar role={session.role} current={section} onChange={setSection} />
      <section className="main-panel">
        <Header role={session.role} title={title} username={session.username} onLogout={onLogout} />
        {renderPage()}
      </section>
    </main>
  );
}

export default Shell;

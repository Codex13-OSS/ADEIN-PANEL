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

const crmTabBySection = { crm: 'prospectos', analyze: 'whatsapp', followups: 'seguimientos', performance: 'acciones' } as const;

type Props = {
  session: { role: Role; username: string };
  defaultSection: OwnerSection | SellerSection;
  onLogout: () => void;
};

function Shell({ session, defaultSection, onLogout }: Props) {
  const [section, setSection] = useState(defaultSection);
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

  const renderPage = () => {
    if (section === 'dashboard') return <OwnerDashboardPage />;
    if (section === 'crm' || section === 'analyze' || section === 'followups' || section === 'performance') return <CrmPage role={session.role} initialTab={crmTabBySection[section as keyof typeof crmTabBySection]} />;
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
        <Header role={session.role} title={title} subtitle={subtitle} username={session.username} onLogout={onLogout} />
        {renderPage()}
      </section>
    </main>
  );
}

export default Shell;

import { Role } from './LoginView';
import { OwnerSection, SellerSection } from './Shell';
import { CrmTab } from '../pages/CrmPage';

type AnySection = OwnerSection | SellerSection;

type NavItem = { key: AnySection; label: string };

const ownerNav: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard maestro' },
  { key: 'crm', label: 'CRM ventas' },
  { key: 'business', label: 'Negocio actual' },
  { key: 'campaigns', label: 'Campañas' },
  { key: 'sellers', label: 'Vendedores' },
  { key: 'documents', label: 'Documentos' },
  { key: 'settings', label: 'Configuración' },
];

const sellerNav: NavItem[] = [
  { key: 'crm', label: 'Prospectos' },
  { key: 'analyze', label: 'Analizar WhatsApp' },
  { key: 'followups', label: 'Seguimientos' },
  { key: 'performance', label: 'Acciones recomendadas' },
  { key: 'documents', label: 'Documentos' },
];

type Props = {
  role: Role;
  current: AnySection;
  onChange: (section: AnySection) => void;
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

const sellerSectionByTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'analyze',
  seguimientos: 'followups',
  acciones: 'performance',
};

type SidebarProps = Props & { activeCrmTab?: CrmTab };

function Sidebar({ role, current, onChange, onLogout, activeCrmTab = 'prospectos', mobileOpen = false, onCloseMobile }: SidebarProps) {
  const nav = role === 'owner' ? ownerNav : sellerNav;
  const sellerCurrent = current === 'documents' ? 'documents' : sellerSectionByTab[activeCrmTab];

  const handleSectionClick = (section: AnySection) => {
    onChange(section);
    onCloseMobile?.();
  };

  const handleLogout = () => {
    onCloseMobile?.();
    onLogout();
  };

  return (
    <>
      <button className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={onCloseMobile} aria-label="Cerrar menú" />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-mobile-top">
          <img src="/brand/adein.png" alt="ADEIN" className="logo-mini" />
          <button className="btn-outline sidebar-close" onClick={onCloseMobile}>Cerrar</button>
        </div>
        <div className="brand-stack">
          <img src="/brand/adein.png" alt="ADEIN" className="logo-mini" />
          <p>Panel comercial inmobiliario</p>
        </div>
        <nav>
          {nav.map((item) => (
            <button key={item.key} onClick={() => handleSectionClick(item.key)} className={(role === 'seller' ? sellerCurrent : current) === item.key ? 'active' : ''}>
              {item.label}
            </button>
          ))}
          <button className="sidebar-logout" onClick={handleLogout}>Cerrar sesión</button>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;

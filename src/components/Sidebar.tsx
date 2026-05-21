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

type Props = { role: Role; current: AnySection; onChange: (section: AnySection) => void };

const sellerSectionByTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'analyze',
  seguimientos: 'followups',
  acciones: 'performance',
  historial: 'crm',
};

type SidebarProps = Props & { activeCrmTab?: CrmTab };

function Sidebar({ role, current, onChange, activeCrmTab = 'prospectos' }: SidebarProps) {
  const nav = role === 'owner' ? ownerNav : sellerNav;
  const sellerCurrent = current === 'documents' ? 'documents' : sellerSectionByTab[activeCrmTab];
  return (
    <aside className="sidebar">
      <div className="brand-stack">
        <img src="/brand/adein.png" alt="ADEIN" className="logo-mini" />
        <p>Panel comercial inmobiliario</p>
      </div>
      <nav>
        {nav.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)} className={(role === 'seller' ? sellerCurrent : current) === item.key ? 'active' : ''}>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;

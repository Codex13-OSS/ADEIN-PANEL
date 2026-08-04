import { Role } from './LoginView';
import { OwnerSection, SellerSection } from './Shell';
import { CrmTab } from '../pages/CrmPage';
import { getSidebarMode } from '../lib/sidebarLayout.mjs';

type AnySection = OwnerSection | SellerSection;

type NavItem = { key: AnySection; label: string };

const ownerNav: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard maestro' },
  { key: 'crm', label: 'CRM ventas' },
  { key: 'business', label: 'Negocio actual' },
  { key: 'documents', label: 'Documentos' },
];

const sellerNav: NavItem[] = [
  { key: 'crm', label: 'Prospectos' },
  { key: 'documents', label: 'Documentos' },
];

type Props = { role: Role; current: AnySection; onChange: (section: AnySection) => void };

const sellerSectionByTab: Record<CrmTab, SellerSection> = {
  prospectos: 'crm',
  whatsapp: 'crm',
  appointments: 'crm',
};

type SidebarProps = Props & { activeCrmTab?: CrmTab; collapsed: boolean; onToggle: () => void };

function Sidebar({ role, current, onChange, activeCrmTab = 'prospectos', collapsed, onToggle }: SidebarProps) {
  const nav = role === 'owner' ? ownerNav : sellerNav;
  const sellerCurrent = current === 'documents' ? 'documents' : sellerSectionByTab[activeCrmTab];
  return (
    <aside className={`sidebar sidebar-${getSidebarMode(collapsed)}`}>
      <div className="brand-stack">
        <img src="/brand/adein.png" alt="ADEIN" className="sidebar-brand-logo" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <p>Panel comercial inmobiliario</p>
      </div>
      <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'} title={collapsed ? 'Expandir navegación' : 'Contraer navegación'}>{collapsed ? '›' : '‹'}</button>
      <nav>
        {nav.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)} className={(role === 'seller' ? sellerCurrent : current) === item.key ? 'active' : ''} aria-label={item.label} title={collapsed ? item.label : undefined}>
            <span className="sidebar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;

import { Role } from './LoginView';
import { OwnerSection, SellerSection } from './Shell';
import { CrmTab } from '../pages/CrmPage';
import { getSidebarMode } from '../lib/sidebarLayout.mjs';

type AnySection = OwnerSection | SellerSection;

type NavItem = { key: AnySection; label: string; icon: JSX.Element };

const HomeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>;
const SalesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M3 3h2l2 12h10l3-8H7"/></svg>;
const BusinessIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M12 12v.01"/></svg>;
const DocsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;

const ownerNav: NavItem[] = [
  { key: 'dashboard', label: 'Inicio', icon: <HomeIcon /> },
  { key: 'crm', label: 'Ventas', icon: <SalesIcon /> },
  { key: 'business', label: 'Mi negocio', icon: <BusinessIcon /> },
  { key: 'documents', label: 'Documentos', icon: <DocsIcon /> },
];

const ExternalIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;

const sellerNav: NavItem[] = [
  { key: 'crm', label: 'Prospectos', icon: <SalesIcon /> },
  { key: 'documents', label: 'Documentos', icon: <DocsIcon /> },
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
      <div className="sidebar-glass-layer" />
      <div className="brand-stack">
        <img src="/brand/adein.png" alt="ADEIN" className="sidebar-brand-logo" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <p>Panel inmobiliario</p>
      </div>
      <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Expandir' : 'Contraer'} title={collapsed ? 'Expandir' : 'Contraer'}>{collapsed ? '›' : '‹'}</button>
      <nav>
        {nav.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)} className={(role === 'seller' ? sellerCurrent : current) === item.key ? 'active' : ''} aria-label={item.label} title={collapsed ? item.label : undefined}>
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <a href="https://www.adein.com.mx" target="_blank" rel="noopener noreferrer" className="sidebar-external-link" title="Sitio ADEIN (abre en nueva pestaña)">
        <span className="sidebar-nav-icon"><ExternalIcon /></span>
        <span className="sidebar-nav-label">Sitio ADEIN</span>
      </a>
      <div className="sidebar-footer">
        <span className="sidebar-version">ADEIN v2</span>
      </div>
    </aside>
  );
}

export default Sidebar;

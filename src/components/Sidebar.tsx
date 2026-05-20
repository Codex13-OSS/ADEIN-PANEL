import { Role } from './LoginView';
import { OwnerSection, SellerSection } from './Shell';

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
  { key: 'crm', label: 'Mi CRM' },
  { key: 'analyze', label: 'Analizar conversación' },
  { key: 'followups', label: 'Mis seguimientos' },
  { key: 'performance', label: 'Mi desempeño' },
  { key: 'documents', label: 'Documentos' },
];

type Props = { role: Role; current: AnySection; onChange: (section: AnySection) => void };

function Sidebar({ role, current, onChange }: Props) {
  const nav = role === 'owner' ? ownerNav : sellerNav;
  return (
    <aside className="sidebar">
      <img src="/brand/logo.png" alt="ADEIN" className="logo-mini" />
      <nav>
        {nav.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)} className={current === item.key ? 'active' : ''}>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;

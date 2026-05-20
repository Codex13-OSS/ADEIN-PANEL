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
  { key: 'crm', label: 'Prospectos' },
  { key: 'analyze', label: 'Analizar WhatsApp' },
  { key: 'followups', label: 'Seguimientos' },
  { key: 'performance', label: 'Acciones recomendadas' },
  { key: 'documents', label: 'Documentos' },
];

type Props = { role: Role; current: AnySection; onChange: (section: AnySection) => void };

function Sidebar({ role, current, onChange }: Props) {
  const nav = role === 'owner' ? ownerNav : sellerNav;
  return (
    <aside className="sidebar">
      <div className="brand-stack">
        <img src="/brand/adein.png" alt="ADEIN" className="logo-mini" />
        <p>Panel comercial inmobiliario</p>
      </div>
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

import { Role } from './LoginView';
import StatusBadge from './StatusBadge';

type Props = {
  title: string;
  subtitle: string;
  role: Role;
  username: string;
  onLogout: () => void;
  onMenuToggle?: () => void;
};

function Header({ title, subtitle, role, username, onLogout, onMenuToggle }: Props) {
  return (
    <header className="app-header">
      <div className="header-main">
        <button className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menú de navegación">
          ☰
        </button>
        <img src="/brand/adein.png" alt="ADEIN" className="header-logo" />
        <div>
          <h1>{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
          <small>{username}</small>
        </div>
      </div>
      <img src="/brand/casitas.png" alt="casitas" className="header-icon" />
      <div className="header-right">
        <StatusBadge>{role === 'owner' ? 'Rol: Dueño / Admin' : 'Rol: Vendedor'}</StatusBadge>
        <StatusBadge tone="success">Panel mock activo</StatusBadge>
        <button className="btn-outline" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}

export default Header;

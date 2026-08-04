import { Role } from './LoginView';
import StatusBadge from './StatusBadge';

type Props = { title: string; subtitle: string; role: Role; onLogout: () => void; showLogout?: boolean };

function Header({ title, subtitle, role, onLogout, showLogout = true }: Props) {
  return (
    <header className="app-header">
      <div>
        <img src="/brand/casitas.png" alt="ADEIN" className="header-brand-logo" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <small>Plataforma LIA OS</small>
        </div>
      </div>
      <div className="header-right">
        <StatusBadge>{role === 'owner' ? 'Rol: Dueño / Admin' : 'Rol: Vendedor'}</StatusBadge>
        <StatusBadge tone="success">Plataforma LIA OS</StatusBadge>
        {showLogout && <button className="btn-outline" onClick={onLogout}>Cerrar sesión</button>}
      </div>
    </header>
  );
}

export default Header;

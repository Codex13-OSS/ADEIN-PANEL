import { Role } from './LoginView';
import StatusBadge from './StatusBadge';

type Props = { title: string; subtitle: string; role: Role; username: string; onLogout: () => void };

function Header({ title, subtitle, role, username, onLogout }: Props) {
  return (
    <header className="app-header">
      <div>
        <div className="header-icon" aria-label="ADEIN dashboard" role="img">AD</div>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <small>{username}</small>
        </div>
      </div>
      <div className="header-right">
        <StatusBadge>{role === 'owner' ? 'Rol: Dueño / Admin' : 'Rol: Vendedor'}</StatusBadge>
        <StatusBadge tone="success">Beta comercial</StatusBadge>
        <button className="btn-outline" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}

export default Header;

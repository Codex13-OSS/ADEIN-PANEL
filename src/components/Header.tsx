import { Role } from './LoginView';
import StatusBadge from './StatusBadge';

type Props = { title: string; role: Role; username: string; onLogout: () => void };

function Header({ title, role, username, onLogout }: Props) {
  return (
    <header className="app-header">
      <div>
        <img src="/brand/casitas.png" alt="casitas" className="header-icon" />
        <div>
          <h1>{title}</h1>
          <p>{username}</p>
        </div>
      </div>
      <div className="header-right">
        <StatusBadge>{role === 'owner' ? 'Rol: Dueño / Admin' : 'Rol: Vendedor'}</StatusBadge>
        <StatusBadge tone="success">Sistema operativo</StatusBadge>
        <button className="btn-outline" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}

export default Header;

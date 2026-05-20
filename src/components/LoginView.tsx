import { FormEvent, useState } from 'react';
import AdeinAnimatedBackground from './AdeinAnimatedBackground';

export type Role = 'owner' | 'seller';

type Props = {
  onLogin: (username: string, role: Role) => void;
};

function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('owner');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    onLogin(username.trim(), role);
  };

  return (
    <main className="login-screen">
      <AdeinAnimatedBackground variant="login" />
      <section className="login-card">
        <img src="/brand/adein.png" alt="ADEIN" className="brand-main" />
        <p className="brand-subtitle">Administradora e Inmobiliaria</p>
        <h1>Iniciar sesión</h1>
        <form onSubmit={submit} className="login-form">
          <label>
            Usuario
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario.demo" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <div className="role-switch">
            <button type="button" className={role === 'owner' ? 'active' : ''} onClick={() => setRole('owner')}>Dueño / Admin</button>
            <button type="button" className={role === 'seller' ? 'active' : ''} onClick={() => setRole('seller')}>Vendedor</button>
          </div>
          <button className="btn-primary" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}

export default LoginView;

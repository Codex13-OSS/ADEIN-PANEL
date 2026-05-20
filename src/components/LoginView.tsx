import { FormEvent, useState } from 'react';
import AdeinAnimatedBackground from './AdeinAnimatedBackground';

export type Role = 'owner' | 'seller';

type Props = {
  onLogin: (username: string, role: Role) => void;
};

function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setError('');
    onLogin(username.trim(), 'owner');
  };

  return (
    <main className="login-page">
      <AdeinAnimatedBackground variant="login" />

      <div className="login-container">
        <div className="login-header">
          <div className="logo-wrapper">
            <img src="/brand/adein.png" alt="ADEIN Logo" className="login-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>

        <div className="login-card">
          <h2>Iniciar sesión</h2>
          <form onSubmit={submit} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="username">Usuario</label>
              <input id="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ingresa tu usuario" autoComplete="username" required />
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <input type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
            </div>

            <button className="login-button" type="submit">Entrar</button>
          </form>

          <div className="login-error" id="login-error">{error}</div>
        </div>
      </div>
    </main>
  );
}

export default LoginView;

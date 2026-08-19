import { FormEvent, useState } from 'react';
import AdeinAnimatedBackground from './AdeinAnimatedBackground';
import { OWNER_AUTH_API } from '../lib/runtimeConfig';

export type Role = 'owner' | 'seller';

type Props = {
  onLogin: (username: string, role: Role, token: string) => void;
};

function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${OWNER_AUTH_API}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        username?: string;
        role?: Role;
        token?: string;
      };

      if (
        !response.ok
        || !payload.ok
        || payload.role !== 'owner'
        || !payload.username
        || !payload.token
      ) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }

      setPassword('');
      onLogin(payload.username, payload.role, payload.token);
    } catch {
      setError('No fue posible validar la sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <AdeinAnimatedBackground variant="login" />

      <div className="login-container">
        <div className="login-header">
          <div className="logo-wrapper">
            <img
              src="/brand/adein.png"
              alt="ADEIN Logo"
              className="login-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        <div className="login-card">
          <h2>Iniciar sesión</h2>

          <form onSubmit={submit} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
              />
            </div>

            <button className="login-button" type="submit" disabled={submitting}>
              {submitting ? 'Validando…' : 'Entrar'}
            </button>
          </form>

          <div className="login-error" id="login-error">{error}</div>
        </div>
      </div>
    </main>
  );
}

export default LoginView;

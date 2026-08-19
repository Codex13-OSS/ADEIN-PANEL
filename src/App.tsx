import { useMemo, useState } from 'react';
import LoginView, { Role } from './components/LoginView';
import Shell, { OwnerSection, SellerSection } from './components/Shell';

const SESSION_KEY = 'adein-panel-session';

type Session = {
  username: string;
  role: Role;
  token: string;
};

const parseSession = (): Session | null => {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<Session>;
    if (!parsed.username || !parsed.role || !parsed.token) return null;
    return parsed as Session;
  } catch {
    return null;
  }
};

function App() {
  const [session, setSession] = useState<Session | null>(() => parseSession());

  const defaultSection = useMemo(() => {
    if (session?.role === 'owner') return 'dashboard' as OwnerSection;
    if (session?.role === 'seller') return 'crm' as SellerSection;
    return null;
  }, [session]);

  if (!session || !defaultSection) {
    return (
      <LoginView
        onLogin={(username, role, token) => {
          const nextSession = { username, role, token };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
          setSession(nextSession);
        }}
      />
    );
  }

  return (
    <Shell
      session={session}
      defaultSection={defaultSection}
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      }}
    />
  );
}

export default App;

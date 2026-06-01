import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '../../../lib/supabase/session';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { SucursalProvider } from '../context/SucursalContext';
import { OwnerSidebar } from './OwnerSidebar';
import { OwnerTopBar } from './OwnerTopBar';

export function OwnerPortal() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getSession()
      .then((s) => setSession(s))
      .catch(() => null);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      void navigate('/', { replace: true });
    } catch {
      showToast({ message: 'Error al cerrar sesión', kind: 'error' });
    }
  }

  const userName = session?.user?.email?.split('@')[0] ?? 'Usuario';

  return (
    <SucursalProvider>
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--bg-b)',
        }}
      >
        <OwnerSidebar
          userName={userName}
          onSignOut={() => void handleSignOut()}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <OwnerTopBar />
          <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SucursalProvider>
  );
}

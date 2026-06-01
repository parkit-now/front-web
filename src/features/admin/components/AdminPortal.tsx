import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '../../../lib/supabase/session';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { useApplicationsList } from '../hooks/useApplications';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';

export function AdminPortal() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const pendingApplications = useApplicationsList('pending');
  const pendingCount = pendingApplications.data?.length ?? 0;

  useEffect(() => {
    getSession()
      .then((s) => setSession(s))
      .catch(() => null);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      void navigate('/login', { replace: true });
    } catch {
      showToast({ message: 'Error al cerrar sesión', kind: 'error' });
    }
  }

  const userName = session?.user?.email?.split('@')[0] ?? 'Admin';

  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .admin-portal-layout { display: none !important; }
          .admin-portal-mobile { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .admin-portal-mobile { display: none !important; }
          .admin-portal-layout { display: flex !important; }
        }
      `}</style>

      {/* Desktop layout */}
      <div
        className="admin-portal-layout"
        style={{ minHeight: '100vh', background: 'var(--bg-b)' }}
      >
        <AdminSidebar
          pendingCount={pendingCount}
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
          <AdminTopBar />
          <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile fallback */}
      <div
        className="admin-portal-mobile"
        style={{
          minHeight: '100vh',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          padding: 32,
          textAlign: 'center',
          background: 'var(--bg-b)',
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--text-1)',
          }}
        >
          PARKIT OPS
        </span>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15 }}>
          Solo disponible en escritorio
        </p>
        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
          Por favor accedé desde una pantalla de al menos 1024px de ancho.
        </p>
      </div>
    </>
  );
}

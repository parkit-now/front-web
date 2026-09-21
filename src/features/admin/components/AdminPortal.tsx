import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '../../../lib/supabase/session';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { MobileBottomNav } from '../../../shared/components/MobileBottomNav';
import { useApplicationsList } from '../hooks/useApplications';
import { ADMIN_NAV_ITEMS, AdminSidebar } from './AdminSidebar';
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
  const mobileNavItems = ADMIN_NAV_ITEMS.map((item) => ({
    to: item.path,
    label: item.label,
    icon: item.icon,
    badge: item.path === '/ops/solicitudes' ? pendingCount : undefined,
  }));

  return (
    <div className="portal-shell admin-portal-layout">
      <div className="portal-body">
        <AdminSidebar
          pendingCount={pendingCount}
          userName={userName}
          onSignOut={() => void handleSignOut()}
        />
        <div className="portal-content">
          <AdminTopBar />
          <main className="portal-main">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav
        items={mobileNavItems}
        ariaLabel="Navegación de administración"
      />
    </div>
  );
}

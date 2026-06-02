import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '../../../lib/supabase/session';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { SucursalProvider, useSucursal } from '../context/SucursalContext';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { IconBuilding } from '../../../shared/components/icons';
import { OwnerSidebar } from './OwnerSidebar';
import { OwnerTopBar } from './OwnerTopBar';

/**
 * Renders the active section, gating on the caller's lots: while the entities
 * load nothing tenant-scoped is shown, and a caller with no owned lots gets a
 * clear empty state instead of a dashboard bound to a non-existent lot.
 */
function OwnerContent() {
  const { isLoading, isError, sucursales } = useSucursal();

  if (isLoading) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando tus estacionamientos...
      </p>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<IconBuilding size={32} />}
        title="No pudimos cargar tus estacionamientos"
        description="Reintentá en unos instantes."
      />
    );
  }

  if (sucursales.length === 0) {
    return (
      <EmptyState
        icon={<IconBuilding size={32} />}
        title="No tenés estacionamientos a tu nombre"
        description="Cuando seas dueño de un estacionamiento aparecerá acá."
      />
    );
  }

  return <Outlet />;
}

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
            <OwnerContent />
          </main>
        </div>
      </div>
    </SucursalProvider>
  );
}

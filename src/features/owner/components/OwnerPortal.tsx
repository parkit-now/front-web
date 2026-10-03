import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '../../../lib/supabase/session';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  SucursalProvider,
  useSucursal,
  type SucursalMode,
} from '../context/SucursalContext';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Button } from '../../../shared/components/ui/Button';
import { IconBuilding } from '../../../shared/components/icons';
import { MobileBottomNav } from '../../../shared/components/MobileBottomNav';
import { OWNER_NAV_ITEMS, OwnerSidebar } from './OwnerSidebar';
import { usePendingApprovalCount } from '../hooks/useReservations';
import { OwnerTopBar } from './OwnerTopBar';
import {
  AdminImpersonationBar,
  ADMIN_BAR_HEIGHT,
} from './AdminImpersonationBar';

/**
 * Renders the active section, gating on the resolved lot. While entities load
 * nothing tenant-scoped is shown. In owner mode a caller with no owned lots gets
 * a clear empty state; in admin mode an unknown `:tenantId` gets a not-found
 * state with a way back instead of a tenant-scoped screen bound to a
 * non-existent lot.
 */
function OwnerContent({ mode }: { mode: SucursalMode }) {
  const navigate = useNavigate();
  const { isLoading, isError, sucursales, notFound } = useSucursal();

  if (isLoading) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando estacionamientos...
      </p>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<IconBuilding size={32} />}
        title="No pudimos cargar los estacionamientos"
        description="Reintentá en unos instantes."
      />
    );
  }

  if (mode === 'admin') {
    if (notFound) {
      return (
        <EmptyState
          icon={<IconBuilding size={32} />}
          title="Estacionamiento no encontrado"
          description="El estacionamiento que intentás abrir no existe o fue eliminado."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void navigate('/ops/inventory')}
            >
              Volver a Estacionamientos
            </Button>
          }
        />
      );
    }
    return <Outlet />;
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

/**
 * Chrome del portal (sidebar + nav móvil). Vive adentro del `SucursalProvider`
 * porque el badge de "Reservas" (las que esperan la respuesta del dueño) se
 * consulta por estacionamiento activo.
 */
function OwnerShell({
  mode,
  userName,
  basePath,
  onSignOut,
}: {
  mode: SucursalMode;
  userName: string;
  basePath: string;
  onSignOut: () => void;
}) {
  const isAdmin = mode === 'admin';
  const { sucursalId } = useSucursal();
  const pendingReservations = usePendingApprovalCount(sucursalId);
  const badges = { reservas: pendingReservations };
  const sidebarOffset = isAdmin ? ADMIN_BAR_HEIGHT : 0;
  const mobileNavItems = OWNER_NAV_ITEMS.map((item) => ({
    to: `${basePath}/${item.segment}`,
    label: item.label,
    icon: item.icon,
    badge: badges[item.segment as keyof typeof badges],
  }));

  return (
    <div className="portal-shell">
      {isAdmin && <AdminImpersonationBar />}
      <div className="portal-body">
        <OwnerSidebar
          userName={userName}
          userRole={isAdmin ? 'Administrador' : 'Dueño'}
          onSignOut={onSignOut}
          basePath={basePath}
          topOffset={sidebarOffset}
          badges={badges}
        />
        <div className="portal-content">
          <OwnerTopBar />
          <main className="portal-main">
            <OwnerContent mode={mode} />
          </main>
        </div>
      </div>
      <MobileBottomNav
        items={mobileNavItems}
        ariaLabel="Navegación de operación"
      />
    </div>
  );
}

export function OwnerPortal({ mode = 'owner' }: { mode?: SucursalMode }) {
  const navigate = useNavigate();
  const params = useParams();
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
  const isAdmin = mode === 'admin';
  const basePath = isAdmin
    ? `/ops/estacionamientos/${params.tenantId ?? ''}`
    : '/app';

  return (
    <SucursalProvider mode={mode}>
      <OwnerShell
        mode={mode}
        userName={userName}
        basePath={basePath}
        onSignOut={() => void handleSignOut()}
      />
    </SucursalProvider>
  );
}

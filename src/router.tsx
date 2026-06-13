import { createBrowserRouter, redirect, Navigate } from 'react-router-dom';
import { fetchMe, getSession, homePathForMe } from './lib/supabase/session';
import { LandingPage } from './features/landing/components/LandingPage';
import { AuthPage } from './features/auth/AuthPage';
import { OnboardingPage } from './features/onboarding/components/OnboardingPage';
import { DashboardPage } from './features/owner/sections/dashboard/DashboardPage';
import { PersonalPage } from './features/owner/sections/personal/PersonalPage';
import { EstadisticasPage } from './features/owner/sections/estadisticas/EstadisticasPage';
import { TransaccionesPage } from './features/owner/sections/transacciones/TransaccionesPage';
import { AuditoriaPage } from './features/owner/sections/auditoria/AuditoriaPage';
import { ConfigPage } from './features/owner/sections/config/ConfigPage';
import { SolicitudesPage } from './features/admin/sections/solicitudes/SolicitudesPage';
import { UsuariosPage } from './features/admin/sections/usuarios/UsuariosPage';
import { InventoryPage } from './features/admin/sections/inventory/InventoryPage';
import { OwnerPortal } from './features/owner/components/OwnerPortal';
import { AdminPortal } from './features/admin/components/AdminPortal';

/**
 * Owner/operations portal: a `user` who belongs to at least one entity (an
 * `owner` membership granted on approval, or an `operator` membership via
 * invitation). Admins go to Ops; a user with no memberships still needs to
 * onboard.
 */
async function appLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const me = await fetchMe(session);
  if (!me) return redirect('/login');

  const home = homePathForMe(me);
  return home === '/app' ? null : redirect(home);
}

/** Ops portal: admins only. */
async function opsLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const me = await fetchMe(session);
  if (!me) return redirect('/login');

  const home = homePathForMe(me);
  return home === '/ops' ? null : redirect(home);
}

/** Onboarding wizard: a `user` with no memberships yet. */
async function onboardingLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const me = await fetchMe(session);
  if (!me) return redirect('/login');

  const home = homePathForMe(me);
  return home === '/onboarding' ? null : redirect(home);
}

/**
 * Owner panel sections, shared between the owner portal (`/app/*`) and an admin
 * entering a specific lot (`/ops/estacionamientos/:tenantId/*`). Paths are
 * relative so they mount under either base.
 */
const ownerSectionRoutes = [
  { path: 'dashboard', element: <DashboardPage /> },
  { path: 'personal', element: <PersonalPage /> },
  { path: 'estadisticas', element: <EstadisticasPage /> },
  { path: 'transacciones', element: <TransaccionesPage /> },
  { path: 'auditoria', element: <AuditoriaPage /> },
  { path: 'config', element: <ConfigPage /> },
];

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <AuthPage /> },
  {
    path: '/onboarding',
    element: <OnboardingPage />,
    loader: onboardingLoader,
  },
  {
    path: '/app',
    element: <OwnerPortal />,
    loader: appLoader,
    children: [
      { index: true, loader: () => redirect('/app/dashboard') },
      ...ownerSectionRoutes,
    ],
  },
  {
    path: '/ops',
    element: <AdminPortal />,
    loader: opsLoader,
    children: [
      { index: true, loader: () => redirect('/ops/solicitudes') },
      { path: 'solicitudes', element: <SolicitudesPage /> },
      { path: 'usuarios', element: <UsuariosPage /> },
      { path: 'inventory', element: <InventoryPage /> },
    ],
  },
  {
    // Admin enters any lot through the owner panel, scoped by `:tenantId` in the
    // URL (deep-linkable). Admin-only via `opsLoader`; the same owner sections
    // are reused, gated by an impersonation banner instead of the admin chrome.
    path: '/ops/estacionamientos/:tenantId',
    element: <OwnerPortal mode="admin" />,
    loader: opsLoader,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      ...ownerSectionRoutes,
    ],
  },
  { path: '*', loader: () => redirect('/') },
]);

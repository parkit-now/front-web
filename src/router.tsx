import { createBrowserRouter, redirect } from 'react-router-dom';
import {
  getRoleFromSession,
  getSession,
  homePathForRole,
} from './lib/supabase/session';
import { getOnboardingState } from './features/onboarding/services/onboarding';
import { LandingPage } from './features/landing/components/LandingPage';
import { AuthPage } from './features/auth/AuthPage';
import { OnboardingPage } from './features/onboarding/components/OnboardingPage';
import { DashboardPage } from './features/owner/sections/dashboard/DashboardPage';
import { EstacionamientosPage } from './features/owner/sections/estacionamientos/EstacionamientosPage';
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

/** Whether the owner's company is approved (full portal access). */
async function companyIsActive(): Promise<boolean> {
  try {
    const state = await getOnboardingState();
    return state.company?.status === 'active';
  } catch {
    return false;
  }
}

/** Owner portal: owners with an active company and operators. */
async function appLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const role = getRoleFromSession(session);
  if (role === 'admin') return redirect('/ops');
  if (role === 'driver') return redirect('/onboarding');
  // An owner whose company is still pending/suspended belongs in onboarding.
  if (role === 'owner' && !(await companyIsActive())) {
    return redirect('/onboarding');
  }
  return null;
}

/** Ops portal: admins only. */
async function opsLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const role = getRoleFromSession(session);
  if (role !== 'admin') return redirect(homePathForRole(role));
  return null;
}

/** Onboarding wizard: owners/drivers without an active company. */
async function onboardingLoader() {
  const session = await getSession();
  if (!session) return redirect('/login');

  const role = getRoleFromSession(session);
  if (role === 'admin') return redirect('/ops');
  if (role === 'operator') return redirect('/app');
  // Owners with an already-approved company go straight to the portal.
  if (await companyIsActive()) return redirect('/app');
  return null;
}

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
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'estacionamientos', element: <EstacionamientosPage /> },
      { path: 'personal', element: <PersonalPage /> },
      { path: 'estadisticas', element: <EstadisticasPage /> },
      { path: 'transacciones', element: <TransaccionesPage /> },
      { path: 'auditoria', element: <AuditoriaPage /> },
      { path: 'config', element: <ConfigPage /> },
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
  { path: '*', loader: () => redirect('/') },
]);

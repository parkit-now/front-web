import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { listMyEntities, type MembershipRole } from '../services/entities';
import { listParkings } from '../../admin/services/parkings';

/**
 * View model of a parking lot (entity/tenant) the caller can switch between.
 * Adapts the backend payloads to the Spanish field names the owner UI uses. The
 * active lot drives every tenant-scoped query in the panel.
 */
export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string | null;
  estado: 'active' | 'maintenance';
  role: MembershipRole;
}

/**
 * Who is driving the panel:
 * - `owner`: a user operating their own lots (active id from memberships + localStorage).
 * - `admin`: a platform admin entering any lot (active id from the URL `:tenantId`,
 *   lot list from `/admin/parkings`). Admins get full owner powers, so their
 *   view-model `role` is forced to `owner` to unlock owner-only UI.
 */
export type SucursalMode = 'owner' | 'admin';

interface SucursalContextValue {
  mode: SucursalMode;
  sucursalId: string;
  setSucursalId: (id: string) => void;
  sucursal: Sucursal | undefined;
  sucursales: Sucursal[];
  isLoading: boolean;
  isError: boolean;
  /** Admin mode only: the `:tenantId` in the URL is not a known lot. */
  notFound: boolean;
}

const SucursalContext = createContext<SucursalContextValue | null>(null);

const ACTIVE_KEY = 'parkit.activeTenantId';

/** Owner sections reachable under both `/app/*` and `/ops/estacionamientos/:id/*`. */
const SECTIONS = [
  'dashboard',
  'personal',
  'estadisticas',
  'transacciones',
  'auditoria',
  'revision-lpr',
  'tasas',
  'vehiculos',
  'metodos-de-pago',
  'config',
] as const;

export function SucursalProvider({
  children,
  mode = 'owner',
}: {
  children: ReactNode;
  mode?: SucursalMode;
}) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Only lots the caller owns: the owner panel manages lots, it does not operate them.
  const ownerQuery = useQuery({
    queryKey: ['my-entities', 'owner'],
    queryFn: () => listMyEntities('owner'),
    enabled: mode === 'owner',
    staleTime: 60_000,
  });

  // Admins have no memberships, so they pick from every parking lot in the platform.
  const adminQuery = useQuery({
    queryKey: ['admin', 'parkings', 'all'],
    queryFn: () => listParkings({ pageSize: 100 }),
    enabled: mode === 'admin',
    staleTime: 60_000,
  });

  const sucursales = useMemo<Sucursal[]>(() => {
    if (mode === 'admin') {
      return (adminQuery.data?.items ?? []).map((p) => ({
        id: p.id,
        nombre: p.name,
        direccion: p.address,
        estado: p.status,
        // Admin operates with full owner powers; unlock owner-only UI gates.
        role: 'owner' as const,
      }));
    }
    return (ownerQuery.data ?? []).map((e) => ({
      id: e.tenantId,
      nombre: e.name,
      direccion: e.address,
      estado: e.status,
      role: e.role,
    }));
  }, [mode, ownerQuery.data, adminQuery.data]);

  const isLoading =
    mode === 'admin' ? adminQuery.isLoading : ownerQuery.isLoading;
  const isError = mode === 'admin' ? adminQuery.isError : ownerQuery.isError;

  // Owner mode: the active lot is persisted across sessions.
  const [ownerSucursalId, setOwnerSucursalIdState] = useState<string>(
    () =>
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(ACTIVE_KEY)
        : null) ?? '',
  );

  // Keep the owner's active id valid: default to the first lot once loaded, and
  // reset if the stored id is no longer among the caller's lots.
  useEffect(() => {
    if (mode !== 'owner') return;
    if (sucursales.length === 0) return;
    const exists = sucursales.some((s) => s.id === ownerSucursalId);
    if (!exists) {
      setOwnerSucursalIdState(sucursales[0].id);
    }
  }, [mode, sucursales, ownerSucursalId]);

  // Admin mode: the active lot lives in the URL, so it is deep-linkable and the
  // browser back button works. We never touch the owner's localStorage here.
  const adminSucursalId = params.tenantId ?? '';
  const sucursalId = mode === 'admin' ? adminSucursalId : ownerSucursalId;

  function setSucursalId(id: string) {
    if (mode === 'admin') {
      const seg = location.pathname.split('/').filter(Boolean).pop() ?? '';
      const section = (SECTIONS as readonly string[]).includes(seg)
        ? seg
        : 'dashboard';
      void navigate(`/ops/estacionamientos/${id}/${section}`);
      return;
    }
    setOwnerSucursalIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_KEY, id);
    }
  }

  const sucursal = sucursales.find((s) => s.id === sucursalId);
  const notFound =
    mode === 'admin' &&
    !isLoading &&
    !isError &&
    sucursalId !== '' &&
    !sucursal;

  return (
    <SucursalContext.Provider
      value={{
        mode,
        sucursalId,
        setSucursalId,
        sucursal,
        sucursales,
        isLoading,
        isError,
        notFound,
      }}
    >
      {children}
    </SucursalContext.Provider>
  );
}

export function useSucursal(): SucursalContextValue {
  const ctx = useContext(SucursalContext);
  if (!ctx) throw new Error('useSucursal must be used within SucursalProvider');
  return ctx;
}

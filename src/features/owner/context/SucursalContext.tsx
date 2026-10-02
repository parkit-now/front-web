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
import { getSession } from '../../../lib/supabase/session';
import {
  readStoredActiveTenant,
  resolveActiveTenantId,
  writeStoredActiveTenant,
} from '../../../lib/tenant/activeTenant';

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

/** Owner sections reachable under both `/app/*` and `/ops/estacionamientos/:id/*`. */
const SECTIONS = [
  'historial',
  'caja',
  'personal',
  'estadisticas',
  'auditoria',
  'tasas',
  'vehiculos',
  'tipos-de-vehiculo',
  'metodos-de-pago',
  'integraciones',
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

  // Who is signed in: the persisted active lot and the entities cache are
  // scoped per user. `undefined` = still resolving, `null` = no session.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (mode !== 'owner') return;
    let alive = true;
    getSession()
      .then((s) => alive && setUserId(s?.user.id ?? null))
      .catch(() => alive && setUserId(null));
    return () => {
      alive = false;
    };
  }, [mode]);

  // Only lots the caller owns: the owner panel manages lots, it does not operate them.
  const ownerQuery = useQuery({
    queryKey: ['my-entities', 'owner', userId],
    queryFn: () => listMyEntities('owner'),
    enabled: mode === 'owner' && typeof userId === 'string',
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
    mode === 'admin'
      ? adminQuery.isLoading
      : userId === undefined || ownerQuery.isLoading;
  const isError =
    mode === 'admin'
      ? adminQuery.isError
      : userId === null || ownerQuery.isError;

  // Owner mode: the active lot is persisted per user, but a stored id is only a
  // CANDIDATE. It is never exposed as `sucursalId` until it is validated against
  // the caller's real lots (`GET /tenants?role=owner`); until then `sucursalId`
  // is '' and every tenant-scoped query (`enabled: Boolean(sucursalId)`) waits.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const ownerIds = useMemo(() => sucursales.map((s) => s.id), [sucursales]);
  const ownerSucursalId = useMemo(() => {
    if (mode !== 'owner' || typeof userId !== 'string') return '';
    return resolveActiveTenantId(
      chosenId ?? readStoredActiveTenant(userId),
      ownerIds,
    );
  }, [mode, userId, chosenId, ownerIds]);

  // Persist the validated (possibly corrected) id so a stale value does not
  // come back on the next reload.
  useEffect(() => {
    if (mode !== 'owner' || typeof userId !== 'string' || !ownerSucursalId) {
      return;
    }
    if (readStoredActiveTenant(userId) !== ownerSucursalId) {
      writeStoredActiveTenant(userId, ownerSucursalId);
    }
  }, [mode, userId, ownerSucursalId]);

  // Admin mode: the active lot lives in the URL, so it is deep-linkable and the
  // browser back button works. We never touch the owner's localStorage here.
  const adminSucursalId = params.tenantId ?? '';
  const sucursalId = mode === 'admin' ? adminSucursalId : ownerSucursalId;

  function setSucursalId(id: string) {
    if (mode === 'admin') {
      const seg = location.pathname.split('/').filter(Boolean).pop() ?? '';
      const section = (SECTIONS as readonly string[]).includes(seg)
        ? seg
        : 'estadisticas';
      void navigate(`/ops/estacionamientos/${id}/${section}`);
      return;
    }
    setChosenId(id);
    if (typeof userId === 'string') writeStoredActiveTenant(userId, id);
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

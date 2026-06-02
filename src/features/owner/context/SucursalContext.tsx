import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { listMyEntities, type MembershipRole } from '../services/entities';

/**
 * View model of a parking lot (entity/tenant) the owner can switch between.
 * Adapts the backend `EntitySummaryDto` to the Spanish field names the owner
 * UI uses. The active lot drives every tenant-scoped query in the panel.
 */
export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string | null;
  estado: 'active' | 'maintenance';
  role: MembershipRole;
}

interface SucursalContextValue {
  sucursalId: string;
  setSucursalId: (id: string) => void;
  sucursal: Sucursal | undefined;
  sucursales: Sucursal[];
  isLoading: boolean;
  isError: boolean;
}

const SucursalContext = createContext<SucursalContextValue | null>(null);

const ACTIVE_KEY = 'parkit.activeTenantId';

export function SucursalProvider({ children }: { children: ReactNode }) {
  // Only lots the caller owns: the panel manages lots, it does not operate them.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-entities', 'owner'],
    queryFn: () => listMyEntities('owner'),
    staleTime: 60_000,
  });

  const sucursales = useMemo<Sucursal[]>(
    () =>
      (data ?? []).map((e) => ({
        id: e.tenantId,
        nombre: e.name,
        direccion: e.address,
        estado: e.status,
        role: e.role,
      })),
    [data],
  );

  const [sucursalId, setSucursalIdState] = useState<string>(
    () =>
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(ACTIVE_KEY)
        : null) ?? '',
  );

  // Keep the active id valid: default to the first lot once loaded, and reset
  // if the stored id is no longer among the caller's lots.
  useEffect(() => {
    if (sucursales.length === 0) return;
    const exists = sucursales.some((s) => s.id === sucursalId);
    if (!exists) {
      setSucursalIdState(sucursales[0].id);
    }
  }, [sucursales, sucursalId]);

  function setSucursalId(id: string) {
    setSucursalIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_KEY, id);
    }
  }

  const sucursal = sucursales.find((s) => s.id === sucursalId);

  return (
    <SucursalContext.Provider
      value={{
        sucursalId,
        setSucursalId,
        sucursal,
        sucursales,
        isLoading,
        isError,
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

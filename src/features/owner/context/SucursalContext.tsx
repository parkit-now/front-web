import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Sucursal } from '../../../types/api';
import { SUCURSALES } from '../../../mock/sucursales';

interface SucursalContextValue {
  sucursalId: string;
  setSucursalId: (id: string) => void;
  sucursal: Sucursal | undefined;
  sucursales: Sucursal[];
}

const SucursalContext = createContext<SucursalContextValue | null>(null);

export function SucursalProvider({ children }: { children: ReactNode }) {
  const [sucursalId, setSucursalId] = useState(SUCURSALES[0].id);
  const sucursal = SUCURSALES.find((s) => s.id === sucursalId);
  return (
    <SucursalContext.Provider
      value={{ sucursalId, setSucursalId, sucursal, sucursales: SUCURSALES }}
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

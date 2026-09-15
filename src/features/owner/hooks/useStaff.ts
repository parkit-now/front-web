import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listStaff, type StaffRole } from '../services/staff';

export interface StaffFilters {
  search?: string;
  role?: StaffRole;

  tenantId?: string;
  page: number;
  pageSize: number;
}

/**
 * `/me/staff` es cross-tenant: el alcance sale de las membresías del que
 * consulta, no de la sucursal activa. Por eso el hook no usa `useSucursal()`
 * — la página decide si acota con `tenantId` o no.
 */
export function useStaffList(filters: StaffFilters) {
  return useQuery({
    queryKey: ['staff', filters],
    queryFn: () => listStaff(filters),
    placeholderData: keepPreviousData,
  });
}

import { useQuery } from '@tanstack/react-query';
import { getKpisBySucursal } from '../../../mock/kpis';
import { useSucursal } from '../context/SucursalContext';

export function useKpis() {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: ['kpis', sucursalId],
    queryFn: () => getKpisBySucursal(sucursalId),
    staleTime: 10_000,
  });
}

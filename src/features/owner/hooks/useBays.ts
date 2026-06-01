import { useQuery } from '@tanstack/react-query';
import { buildBays } from '../../../mock/bays';
import { useSucursal } from '../context/SucursalContext';

export function useBays() {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: ['bays', sucursalId],
    queryFn: () => buildBays(sucursalId),
    staleTime: 10_000,
  });
}

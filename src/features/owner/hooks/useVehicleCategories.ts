import { useQuery } from '@tanstack/react-query';
import {
  listVehicleCategories,
  type VehicleCategoryItem,
} from '../services/vehicle-categories';

const EMPTY: VehicleCategoryItem[] = [];

/**
 * Las categorías son una lista cerrada que solo cambia por migración del
 * backend: se piden una vez por sesión y no se vuelven a refetchear.
 */
export function useVehicleCategories() {
  const query = useQuery({
    queryKey: ['vehicle-categories'],
    queryFn: listVehicleCategories,
    staleTime: Infinity,
  });
  return {
    categories: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

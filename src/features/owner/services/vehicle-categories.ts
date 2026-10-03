import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type VehicleCategory = components['schemas']['VehicleCategory'];
export type ReservableVehicleCategory =
  components['schemas']['ReservableVehicleCategory'];
export type VehicleCategoryItem = components['schemas']['VehicleCategoryDto'];

/** GET /vehicle-categories — la lista cerrada de la plataforma, ya ordenada. */
export async function listVehicleCategories(): Promise<VehicleCategoryItem[]> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return apiRequest<VehicleCategoryItem[]>({
    method: 'GET',
    path: '/vehicle-categories',
    bearer: session.access_token,
  });
}

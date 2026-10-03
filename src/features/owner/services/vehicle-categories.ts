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

/** Etiqueta de una categoría; si la lista no cargó todavía, el código crudo. */
export function categoryLabel(
  categories: readonly VehicleCategoryItem[],
  code: string,
): string {
  return categories.find((c) => c.code === code)?.label ?? code;
}

/** Solo las categorías que el conductor puede reservar, en el orden del servidor. */
export function reservableCategories(
  categories: readonly VehicleCategoryItem[],
): VehicleCategoryItem[] {
  return categories.filter((c) => c.reservable);
}

/** "Nombre · Categoría", como se muestra en los selects de tipo. */
export function typeOptionLabel(
  type: { name: string; category: string },
  categories: readonly VehicleCategoryItem[],
): string {
  return `${type.name} · ${categoryLabel(categories, type.category)}`;
}

import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Vehicle = components['schemas']['VehicleCatalogItemDto'];
export type CreateVehicleInput = components['schemas']['CreateVehicleDto'];
export type UpdateVehicleInput = components['schemas']['UpdateVehicleDto'];
export type VehicleType = NonNullable<CreateVehicleInput['type']>;

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/vehicles — los globales del sistema más los propios de
 * este estacionamiento, ordenados por marca y modelo.
 *
 * No confundir con `/vehicles/catalog`, que es el feed de sincronización del
 * desktop: ese SÍ devuelve las filas borradas (con `deletedAt` no-nulo) porque
 * el tombstone es la única forma de comunicarle una baja a un cliente offline.
 * Este endpoint las excluye, que es lo que corresponde para una tabla.
 */
export async function listVehicles(tenantId: string): Promise<Vehicle[]> {
  return apiRequest<Vehicle[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/vehicles`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/vehicles — solo owner. Responde 201 (a diferencia de
 * las tasas, que responden 200) y el `id` (UUIDv7) lo genera el cliente.
 *
 * Siempre crea un vehículo del estacionamiento activo: el catálogo global lo
 * siembra la plataforma y no se puede escribir por esta API.
 */
export async function createVehicle(
  tenantId: string,
  body: CreateVehicleInput,
): Promise<Vehicle> {
  return apiRequest<Vehicle>({
    method: 'POST',
    path: `/tenants/${tenantId}/vehicles`,
    body,
    bearer: await bearer(),
  });
}

/**
 * PATCH /tenants/:tenantId/vehicles/:id — solo owner, con optimistic locking.
 * Si `expectedVersion` quedó vieja el backend responde 409 en lugar de pisar el
 * cambio de otra persona.
 */
export async function updateVehicle(
  tenantId: string,
  vehicleId: string,
  expectedVersion: number,
  body: UpdateVehicleInput,
): Promise<Vehicle> {
  return apiRequest<Vehicle>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/vehicles/${vehicleId}?expectedVersion=${expectedVersion}`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/vehicles/:id — solo owner, con optimistic locking.
 * Es borrado lógico: el backend marca `deleted_at` y la fila sigue viajando por
 * `/vehicles/catalog` como tombstone, para que el desktop la borre de su copia
 * local. Un borrado físico no emitiría nada y el vehículo quedaría ahí para
 * siempre.
 */
export async function deleteVehicle(
  tenantId: string,
  vehicleId: string,
  expectedVersion: number,
): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/vehicles/${vehicleId}?expectedVersion=${expectedVersion}`,
    bearer: await bearer(),
  });
}

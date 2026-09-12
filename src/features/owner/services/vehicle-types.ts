import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type VehicleType = components['schemas']['VehicleTypeListItemDto'];
export type CreateVehicleTypeInput =
  components['schemas']['CreateVehicleTypeDto'];
export type UpdateVehicleTypeInput =
  components['schemas']['UpdateVehicleTypeDto'];
export type DeleteVehicleTypeResult =
  components['schemas']['DeleteVehicleTypeResultDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/vehicle-types — los tipos vivos del estacionamiento,
 * ordenados por nombre, cada uno con cuántos vehículos lo usan.
 *
 * `vehicleCount` es una foto para decidir qué diálogo de borrado abrir. La
 * verdad la impone el 409 `VEHICLE_TYPE_IN_USE` del servidor: si otra persona
 * asignó un vehículo mientras el modal estaba abierto, el conteo local miente.
 */
export async function listVehicleTypes(
  tenantId: string,
): Promise<VehicleType[]> {
  return apiRequest<VehicleType[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/vehicle-types`,
    bearer: await bearer(),
  });
}

/** POST /tenants/:tenantId/vehicle-types — solo owner. `id` UUIDv7 del cliente. */
export async function createVehicleType(
  tenantId: string,
  body: CreateVehicleTypeInput,
): Promise<VehicleType> {
  return apiRequest<VehicleType>({
    method: 'POST',
    path: `/tenants/${tenantId}/vehicle-types`,
    body,
    bearer: await bearer(),
  });
}

/**
 * PATCH /tenants/:tenantId/vehicle-types/:typeId?expectedVersion=N — solo owner.
 *
 * Omitir `expectedVersion` da 400 (el pipe lo exige), no 409. Que no coincida
 * da 409 con code `CONFLICT` genérico.
 */
export async function updateVehicleType(
  tenantId: string,
  typeId: string,
  expectedVersion: number,
  body: UpdateVehicleTypeInput,
): Promise<VehicleType> {
  const query = new URLSearchParams({
    expectedVersion: String(expectedVersion),
  });
  return apiRequest<VehicleType>({
    method: 'PATCH',
    path: `/tenants/${encodeURIComponent(tenantId)}/vehicle-types/${encodeURIComponent(typeId)}?${query}`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/vehicle-types/:typeId?expectedVersion=N — solo owner.
 *
 * Borrado lógico. Si quedan vehículos usando el tipo hay que mandar
 * `reassignToTypeId`; sin eso responde 409 `VEHICLE_TYPE_IN_USE`.
 *
 * Devuelve 200 con `{reassignedVehicles, reassignedToTypeId}` y no 204: los
 * vehículos reasignados cambiaron de `syncSeq`, así que el catálogo hay que
 * refetchearlo.
 */
export async function deleteVehicleType(
  tenantId: string,
  typeId: string,
  expectedVersion: number,
  reassignToTypeId?: string,
): Promise<DeleteVehicleTypeResult> {
  const query = new URLSearchParams({
    expectedVersion: String(expectedVersion),
  });
  if (reassignToTypeId) query.set('reassignToTypeId', reassignToTypeId);
  return apiRequest<DeleteVehicleTypeResult>({
    method: 'DELETE',
    path: `/tenants/${encodeURIComponent(tenantId)}/vehicle-types/${encodeURIComponent(typeId)}?${query}`,
    bearer: await bearer(),
  });
}

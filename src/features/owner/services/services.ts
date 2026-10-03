import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type ServiceItem = components['schemas']['ServiceCatalogItemDto'];
export type ServiceCode = ServiceItem['code'];
export type UpdateServiceInput = components['schemas']['UpdateServiceDto'];
export type ReservationHours = components['schemas']['ReservationHoursDto'];
export type ReservationHourRange =
  components['schemas']['ReservationHourRangeDto'];
export type ReservationRequirement =
  components['schemas']['ReservationRequirement'];
export type ReservationVehicleCategory =
  components['schemas']['ReservableVehicleCategory'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/** GET /tenants/:tenantId/services — full catalog with enabled state. */
export async function listServices(tenantId: string): Promise<ServiceItem[]> {
  return apiRequest<ServiceItem[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/services`,
    bearer: await bearer(),
  });
}

/**
 * PATCH /tenants/:tenantId/services/:code — owner-only. Prende/apaga el
 * servicio y edita la configuración de reservas (plazas, tarifa, vehículos,
 * reglas). Activar sin cumplir los requisitos da 422
 * `SERVICE_RESERVATION_NOT_READY` con `missing` en el body.
 */
export async function updateService(
  tenantId: string,
  code: ServiceCode,
  body: UpdateServiceInput,
): Promise<ServiceItem> {
  return apiRequest<ServiceItem>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/services/${code}`,
    body,
    bearer: await bearer(),
  });
}

/** GET /tenants/:tenantId/services/ADVANCE_RESERVATION/hours — cualquier miembro. */
export async function getReservationHours(
  tenantId: string,
): Promise<ReservationHours> {
  return apiRequest<ReservationHours>({
    method: 'GET',
    path: `/tenants/${tenantId}/services/ADVANCE_RESERVATION/hours`,
    bearer: await bearer(),
  });
}

/**
 * PUT /tenants/:tenantId/services/ADVANCE_RESERVATION/hours — owner-only.
 * Reemplaza el set completo. En modo `opening` los rangos se ignoran y se
 * borran.
 */
export async function putReservationHours(
  tenantId: string,
  body: ReservationHours,
): Promise<ReservationHours> {
  return apiRequest<ReservationHours>({
    method: 'PUT',
    path: `/tenants/${tenantId}/services/ADVANCE_RESERVATION/hours`,
    body,
    bearer: await bearer(),
  });
}

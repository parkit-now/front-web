import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Rate = components['schemas']['RateDto'];
export type CreateRateInput = components['schemas']['CreateRateDto'];
export type UpdateRateInput = components['schemas']['UpdateRateDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/rates — tarifas del estacionamiento, ordenadas por
 * nombre. El backend devuelve solo las activas salvo que se pida lo contrario,
 * así que el ABM tiene que pasar `includeInactive` para poder mostrar (y
 * reactivar) las dadas de baja.
 */
export async function listRates(
  tenantId: string,
  includeInactive = false,
): Promise<Rate[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest<Rate[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/rates${query}`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/rates — solo owner. Responde 200 (no 201) y el `id`
 * (UUIDv7) lo genera el cliente.
 */
export async function createRate(
  tenantId: string,
  body: CreateRateInput,
): Promise<Rate> {
  return apiRequest<Rate>({
    method: 'POST',
    path: `/tenants/${tenantId}/rates`,
    body,
    bearer: await bearer(),
  });
}

/** PATCH /tenants/:tenantId/rates/:id — solo owner, optimistic locking. */
export async function updateRate(
  tenantId: string,
  rateId: string,
  expectedVersion: number,
  body: UpdateRateInput,
): Promise<Rate> {
  return apiRequest<Rate>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/rates/${rateId}?expectedVersion=${expectedVersion}`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/rates/:id — solo owner, optimistic locking.
 * Es borrado físico: no hay tombstone, así que el pull incremental
 * (`/rates/changes`) no propaga la baja al desktop.
 */
export async function deleteRate(
  tenantId: string,
  rateId: string,
  expectedVersion: number,
): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/rates/${rateId}?expectedVersion=${expectedVersion}`,
    bearer: await bearer(),
  });
}

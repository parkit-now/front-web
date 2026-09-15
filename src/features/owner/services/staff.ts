import type { components, operations } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type StaffMember = components['schemas']['StaffMemberDto'];
export type StaffMembership = components['schemas']['StaffMembershipDto'];
export type PaginatedStaff = components['schemas']['PaginatedStaffDto'];
export type StaffRole = NonNullable<
  operations['staffList']['parameters']['query']
>['role'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * Personal de las sucursales donde el que consulta es `owner`.
 *
 * **No lleva `:tenantId` en el path**: el alcance sale de las membresías del
 * llamador, no de la URL. Por eso:
 *
 * - Devuelve **una fila por persona** con todas sus membresías; quien trabaja
 *   en dos sucursales aparece una vez con dos roles.
 * - `role` filtra **quién aparece**, no qué se muestra: alguien que es
 *   `operator` en una sucursal y `owner` en otra sale bajo cualquiera de los
 *   dos filtros, con ambos roles visibles.
 * - Un `operator` (o un admin sin membresías) recibe `{ items: [], total: 0 }`,
 *   no un 403.
 *
 * `tenantId` acota a una sucursal propia; una ajena responde 403.
 */
export async function listStaff(input: {
  search?: string;
  role?: StaffRole;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedStaff> {
  const params = new URLSearchParams();
  if (input.search) params.set('search', input.search);
  if (input.role) params.set('role', input.role);
  if (input.tenantId) params.set('tenantId', input.tenantId);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined)
    params.set('pageSize', String(input.pageSize));

  const qs = params.toString();
  return apiRequest<PaginatedStaff>({
    method: 'GET',
    path: `/me/staff${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}

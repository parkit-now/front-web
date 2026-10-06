import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type LprIgnoredPlate = components['schemas']['LprIgnoredPlateDto'];
export type CreateLprIgnoredPlate =
  components['schemas']['CreateLprIgnoredPlateDto'];
export type UpdateLprIgnoredPlate =
  components['schemas']['UpdateLprIgnoredPlateDto'];

async function request<T>(
  tenantId: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  suffix = '',
  body?: CreateLprIgnoredPlate | UpdateLprIgnoredPlate,
): Promise<T> {
  const session = await getSession();
  if (!session) throw new Error('No active session');
  return apiRequest<T>({
    method,
    path: `/tenants/${encodeURIComponent(tenantId)}/lpr-ignored-plates${suffix}`,
    body,
    bearer: session.access_token,
  });
}
export function listLprIgnoredPlates(tenantId: string) {
  return request<LprIgnoredPlate[]>(tenantId, 'GET');
}
export function createLprIgnoredPlate(
  tenantId: string,
  body: CreateLprIgnoredPlate,
) {
  return request<LprIgnoredPlate>(tenantId, 'POST', '', body);
}
export function updateLprIgnoredPlate(
  tenantId: string,
  row: LprIgnoredPlate,
  body: UpdateLprIgnoredPlate,
) {
  return request<LprIgnoredPlate>(
    tenantId,
    'PATCH',
    `/${encodeURIComponent(row.id)}?expectedVersion=${row.version}`,
    body,
  );
}
export function deleteLprIgnoredPlate(tenantId: string, row: LprIgnoredPlate) {
  return request<LprIgnoredPlate>(
    tenantId,
    'DELETE',
    `/${encodeURIComponent(row.id)}?expectedVersion=${row.version}`,
  );
}

import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type ServiceItem = components['schemas']['ServiceCatalogItemDto'];
export type ServiceCode = ServiceItem['code'];
export type UpdateServiceInput = components['schemas']['UpdateServiceDto'];

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

/** PATCH /tenants/:tenantId/services/:code — owner-only; set enabled and/or spots. */
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

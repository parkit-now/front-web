import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Client = components['schemas']['ClientDto'];
export type CreateClient = components['schemas']['CreateClientDto'];
export type UpdateClient = components['schemas']['UpdateClientDto'];

async function request<T>(
  tenantId: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  suffix = '',
  body?: CreateClient | UpdateClient,
): Promise<T> {
  const session = await getSession();
  if (!session) throw new Error('No active session');
  return apiRequest<T>({
    method,
    path: `/tenants/${encodeURIComponent(tenantId)}/clients${suffix}`,
    body,
    bearer: session.access_token,
  });
}
export const listClients = (tenantId: string) =>
  request<Client[]>(tenantId, 'GET');
export const createClient = (tenantId: string, body: CreateClient) =>
  request<Client>(tenantId, 'POST', '', body);
export const updateClient = (
  tenantId: string,
  row: Client,
  body: UpdateClient,
) =>
  request<Client>(
    tenantId,
    'PATCH',
    `/${encodeURIComponent(row.id)}?expectedVersion=${row.version}`,
    body,
  );
export const deleteClient = (tenantId: string, row: Client) =>
  request<Client>(
    tenantId,
    'DELETE',
    `/${encodeURIComponent(row.id)}?expectedVersion=${row.version}`,
  );

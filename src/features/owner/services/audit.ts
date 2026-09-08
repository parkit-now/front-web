import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

type GeneratedAuditEvent = components['schemas']['AuditEventDto'];
export type AuditSeverity = GeneratedAuditEvent['severity'];

export type AuditEventMetadata = Record<string, unknown>;

export type AuditEvent = GeneratedAuditEvent & {
  metadata?: unknown;
};

export type ListAuditEventsParams = {
  limit?: number;
  severity?: AuditSeverity;
};

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

export async function listAuditEvents(
  tenantId: string,
  params: ListAuditEventsParams = {},
): Promise<AuditEvent[]> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 500));
  if (params.severity) {
    search.set('severity', params.severity);
  }

  return apiRequest<AuditEvent[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/audit?${search.toString()}`,
    bearer: await bearer(),
  });
}

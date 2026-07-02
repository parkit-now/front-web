import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getLprDetectionEventImageSignedUrl } from '../../../lib/api/lpr-events';
import { getSession } from '../../../lib/supabase/session';

export type LprDetectionEvent = components['schemas']['LprDetectionEventDto'];
export type LprDetectionStatus = LprDetectionEvent['status'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

export async function listLprDetectionEvents(input: {
  tenantId: string;
  status?: LprDetectionStatus;
  limit?: number;
}): Promise<LprDetectionEvent[]> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.limit !== undefined) params.set('limit', String(input.limit));

  const qs = params.toString();
  return apiRequest<LprDetectionEvent[]>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}

export async function getLprDetectionEventImageUrl(input: {
  tenantId: string;
  eventId: string;
}): Promise<string> {
  const signed = await getLprDetectionEventImageSignedUrl({
    tenantId: input.tenantId,
    eventId: input.eventId,
    bearer: await bearer(),
  });
  return signed.url;
}

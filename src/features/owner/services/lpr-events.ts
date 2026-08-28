import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getLprDetectionEventImageSignedUrl } from '../../../lib/api/lpr-events';
import { getSession } from '../../../lib/supabase/session';

export type LprDetectionEvent = components['schemas']['LprDetectionEventDto'];
export type LprDetectionStatus = LprDetectionEvent['status'];
export type PaginatedLprDetectionEvents =
  components['schemas']['PaginatedLprDetectionEventsDto'];

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
  page?: number;
  pageSize?: number;
  firstSeenFrom?: string;
  firstSeenTo?: string;
}): Promise<PaginatedLprDetectionEvents> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined)
    params.set('pageSize', String(input.pageSize));
  if (input.firstSeenFrom) params.set('firstSeenFrom', input.firstSeenFrom);
  if (input.firstSeenTo) params.set('firstSeenTo', input.firstSeenTo);

  const qs = params.toString();
  return apiRequest<PaginatedLprDetectionEvents>({
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

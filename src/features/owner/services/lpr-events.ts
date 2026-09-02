import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getLprDetectionEventImageSignedUrl } from '../../../lib/api/lpr-events';
import { getSession } from '../../../lib/supabase/session';

export type LprDetectionEvent = components['schemas']['LprDetectionEventDto'];
export type LprDetectionStatus = LprDetectionEvent['status'];

export type LprEventHistoryItem =
  components['schemas']['LprEventHistoryItemDto'];
export type LprEventHistoryPage =
  components['schemas']['LprEventHistoryPageDto'];
export type LprEventDirection = LprEventHistoryItem['direction'];

export interface LprEventHistoryFilters {
  /** ISO 8601 lower bound on the detection timestamp (`lastSeenAt`). */
  from?: string;
  /** ISO 8601 upper bound on the detection timestamp (`lastSeenAt`). */
  to?: string;
  /** Plate query — the backend normalizes and prefix-matches it. */
  plate?: string;
  direction?: LprEventDirection;
}

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

/**
 * Owner-facing audit history: a paginated, newest-first feed of past LPR
 * detections filtered by timestamp range, plate and movement direction.
 */
export async function listLprEventHistory(input: {
  tenantId: string;
  filters?: LprEventHistoryFilters;
  page?: number;
  pageSize?: number;
}): Promise<LprEventHistoryPage> {
  const params = new URLSearchParams();
  const { filters } = input;
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.plate?.trim()) params.set('plate', filters.plate.trim());
  if (filters?.direction) params.set('direction', filters.direction);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined) {
    params.set('pageSize', String(input.pageSize));
  }

  const qs = params.toString();
  return apiRequest<LprEventHistoryPage>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events/history${qs ? `?${qs}` : ''}`,
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

export async function archiveLprDetectionEvent(input: {
  tenantId: string;
  eventId: string;
}): Promise<LprDetectionEvent> {
  return apiRequest<LprDetectionEvent>({
    method: 'PATCH',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events/${encodeURIComponent(input.eventId)}/archive`,
    bearer: await bearer(),
  });
}

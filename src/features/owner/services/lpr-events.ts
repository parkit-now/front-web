import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getLprDetectionEventImageSignedUrl } from '../../../lib/api/lpr-events';
import { getSession } from '../../../lib/supabase/session';

export type LprDetectionEvent = components['schemas']['LprDetectionEventDto'];
export type LprDetectionStatus = LprDetectionEvent['status'];
export type PaginatedLprDetectionEvents =
  components['schemas']['PaginatedLprDetectionEventsDto'];
export type LprDetectionEventChangesResponse =
  components['schemas']['LprDetectionEventChangesResponseDto'];

const LPR_CHANGES_PAGE_SIZE = 500;

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
  entryIds?: string[];
}): Promise<PaginatedLprDetectionEvents> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined)
    params.set('pageSize', String(input.pageSize));
  if (input.firstSeenFrom) params.set('firstSeenFrom', input.firstSeenFrom);
  if (input.firstSeenTo) params.set('firstSeenTo', input.firstSeenTo);
  if (input.entryIds?.length) params.set('entryIds', input.entryIds.join(','));

  const qs = params.toString();
  return apiRequest<PaginatedLprDetectionEvents>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}

async function listLprDetectionEventChanges(input: {
  tenantId: string;
  afterSeq?: number;
  limit?: number;
}): Promise<LprDetectionEventChangesResponse> {
  const params = new URLSearchParams({
    afterSeq: String(input.afterSeq ?? 0),
    limit: String(input.limit ?? LPR_CHANGES_PAGE_SIZE),
  });
  return apiRequest<LprDetectionEventChangesResponse>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events/changes?${params.toString()}`,
    bearer: await bearer(),
  });
}

function pickEventsForEntries(
  events: LprDetectionEvent[],
  entryIds: Set<string>,
): LprDetectionEvent[] {
  return events.filter(
    (event) =>
      event.status === 'registered' &&
      event.entryId &&
      entryIds.has(event.entryId) &&
      !event.imageDeletedAt,
  );
}

async function listRegisteredLprEventsByChanges(input: {
  tenantId: string;
  entryIds: Set<string>;
}): Promise<LprDetectionEvent[]> {
  const byEntryId = new Map<string, LprDetectionEvent>();
  let afterSeq = 0;

  while (true) {
    const page = await listLprDetectionEventChanges({
      tenantId: input.tenantId,
      afterSeq,
      limit: LPR_CHANGES_PAGE_SIZE,
    });
    const items = page.items ?? [];
    for (const event of pickEventsForEntries(items, input.entryIds)) {
      const current = byEntryId.get(event.entryId!);
      if (
        !current ||
        new Date(event.lastSeenAt).getTime() >
          new Date(current.lastSeenAt).getTime()
      ) {
        byEntryId.set(event.entryId!, event);
      }
    }

    if (
      byEntryId.size >= input.entryIds.size ||
      items.length < LPR_CHANGES_PAGE_SIZE ||
      page.maxSeq <= afterSeq
    ) {
      break;
    }
    afterSeq = page.maxSeq;
  }

  return [...byEntryId.values()];
}

export async function listRegisteredLprDetectionEventsForEntries(input: {
  tenantId: string;
  entryIds: string[];
}): Promise<LprDetectionEvent[]> {
  const entryIds = new Set(input.entryIds);
  if (entryIds.size === 0) return [];

  try {
    const page = await listLprDetectionEvents({
      tenantId: input.tenantId,
      status: 'registered',
      entryIds: [...entryIds],
      page: 1,
      pageSize: Math.min(100, Math.max(entryIds.size, 20)),
    });
    const related = pickEventsForEntries(page.items ?? [], entryIds);
    if (related.length > 0 || (page.items ?? []).length === 0) {
      return related;
    }
  } catch {
    // Fallback for a backend still running without the entryIds query filter.
  }

  return listRegisteredLprEventsByChanges({
    tenantId: input.tenantId,
    entryIds,
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

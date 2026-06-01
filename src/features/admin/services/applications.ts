import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type ApplicationSummary = components['schemas']['ApplicationDto'];
export type ApplicationDetail = components['schemas']['ApplicationDetailDto'];
export type ApplicationStatus = ApplicationSummary['status'];

/**
 * Typed view of `ApplicationDetail.declaredEntity` (an opaque JSON snapshot).
 * Mirrors the applicant's declared parking lot.
 */
export type DeclaredEntity = {
  name?: string;
  address?: string;
  legalName?: string;
  cuit?: string;
  email?: string;
  phone?: string;
  carSpots?: number;
  motorcycleSpots?: number;
  bicycleSpots?: number;
};

export function readDeclaredEntity(
  detail: ApplicationDetail | null | undefined,
): DeclaredEntity {
  const raw = detail?.declaredEntity;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/** GET /admin/applications — review queue, optionally filtered by status. */
export async function listApplications(
  status?: ApplicationStatus,
): Promise<ApplicationSummary[]> {
  const query = status ? `?status=${status}` : '';
  return apiRequest<ApplicationSummary[]>({
    method: 'GET',
    path: `/admin/applications${query}`,
    bearer: await bearer(),
  });
}

/** GET /admin/applications/:id — full detail for the reviewer. */
export async function getApplicationDetail(
  id: string,
): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>({
    method: 'GET',
    path: `/admin/applications/${id}`,
    bearer: await bearer(),
  });
}

/** POST /admin/applications/:id/approve — materializes the entity + owner membership. */
export async function approveApplication(
  id: string,
): Promise<ApplicationSummary> {
  return apiRequest<ApplicationSummary>({
    method: 'POST',
    path: `/admin/applications/${id}/approve`,
    bearer: await bearer(),
  });
}

/** POST /admin/applications/:id/reject — stores a reason; the applicant may resubmit. */
export async function rejectApplication(
  id: string,
  reason: string,
): Promise<ApplicationSummary> {
  return apiRequest<ApplicationSummary>({
    method: 'POST',
    path: `/admin/applications/${id}/reject`,
    body: { reason },
    bearer: await bearer(),
  });
}

import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Parking = components['schemas']['ParkingDto'];
export type ParkingStatus = Parking['status'];
export type CreateParkingInput = components['schemas']['CreateParkingDto'];
export type UpdateParkingInput = components['schemas']['UpdateParkingDto'];
export type PaginatedParkings = components['schemas']['PaginatedParkingsDto'];

export type ListParkingsParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

function buildQuery(params: ListParkingsParams): string {
  const search = new URLSearchParams();
  if (params.search?.trim()) search.set('search', params.search.trim());
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** GET /admin/parkings — paginated, searchable parking-lot list. */
export async function listParkings(
  params: ListParkingsParams = {},
): Promise<PaginatedParkings> {
  return apiRequest<PaginatedParkings>({
    method: 'GET',
    path: `/admin/parkings${buildQuery(params)}`,
    bearer: await bearer(),
  });
}

/** GET /admin/parkings/:id — single parking lot. */
export async function getParking(id: string): Promise<Parking> {
  return apiRequest<Parking>({
    method: 'GET',
    path: `/admin/parkings/${id}`,
    bearer: await bearer(),
  });
}

/** POST /admin/parkings — create a parking lot with basic data (no owner). */
export async function createParking(
  body: CreateParkingInput,
): Promise<Parking> {
  return apiRequest<Parking>({
    method: 'POST',
    path: '/admin/parkings',
    body,
    bearer: await bearer(),
  });
}

/** PATCH /admin/parkings/:id — edit basic data and/or status. */
export async function updateParking(
  id: string,
  body: UpdateParkingInput,
): Promise<Parking> {
  return apiRequest<Parking>({
    method: 'PATCH',
    path: `/admin/parkings/${id}`,
    body,
    bearer: await bearer(),
  });
}

/** DELETE /admin/parkings/:id — permanently delete (cascades dependents). */
export async function deleteParking(id: string): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/admin/parkings/${id}`,
    bearer: await bearer(),
  });
}

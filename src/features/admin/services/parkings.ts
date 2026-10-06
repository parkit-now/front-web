import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Parking = components['schemas']['ParkingDto'];
export type ParkingStatus = Parking['status'];
export type CreateParkingInput = components['schemas']['CreateParkingDto'];
export type UpdateParkingInput = components['schemas']['UpdateParkingDto'];
export type PaginatedParkings = components['schemas']['PaginatedParkingsDto'];
export type DeletionPreflight = components['schemas']['DeletionPreflightDto'];
export type DeleteParkingInput = components['schemas']['DeleteParkingDto'];
export type DeletionResult = components['schemas']['DeletionResultDto'];

export type ListParkingsParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  /** Traer también los dados de baja, para poder restaurarlos. */
  includeDeleted?: boolean;
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
  if (params.includeDeleted) search.set('includeDeleted', 'true');
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

/**
 * GET /admin/parkings/:id/deletion-preflight — qué se va a destruir.
 *
 * Se pide al abrir el modal, antes de que nadie confirme nada: el borrado
 * anterior era un click sobre un diálogo que no decía cuánto se llevaba.
 */
export async function getDeletionPreflight(
  id: string,
): Promise<DeletionPreflight> {
  return apiRequest<DeletionPreflight>({
    method: 'GET',
    path: `/admin/parkings/${id}/deletion-preflight`,
    bearer: await bearer(),
  });
}

/**
 * POST /admin/parkings/:id/deletion — baja lógica con ventana de gracia.
 *
 * No borra: marca. El estacionamiento desaparece de todas las lecturas y un
 * job lo borra de verdad —base y bucket— pasados los `graceDays`. Hasta
 * entonces se puede restaurar.
 */
export async function deleteParking(
  id: string,
  body: DeleteParkingInput,
): Promise<DeletionResult> {
  return apiRequest<DeletionResult>({
    method: 'POST',
    path: `/admin/parkings/${id}/deletion`,
    body,
    bearer: await bearer(),
  });
}

/** POST /admin/parkings/:id/restore — deshace la baja, antes de la purga. */
export async function restoreParking(id: string): Promise<Parking> {
  return apiRequest<Parking>({
    method: 'POST',
    path: `/admin/parkings/${id}/restore`,
    bearer: await bearer(),
  });
}

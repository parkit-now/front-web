import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type AdminUser = components['schemas']['AdminUserDto'];
export type AdminUserDetail = components['schemas']['AdminUserDetailDto'];
export type AdminUserMembership =
  components['schemas']['AdminUserMembershipDto'];
export type PaginatedUsers = components['schemas']['PaginatedUsersDto'];
export type UserRole = AdminUser['role'];
export type MembershipRole = AdminUserMembership['role'];
export type CreateMembershipInput =
  components['schemas']['CreateMembershipDto'];
export type UpdateMembershipInput =
  components['schemas']['UpdateMembershipDto'];

export type ListUsersParams = {
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

function buildQuery(params: ListUsersParams): string {
  const search = new URLSearchParams();
  if (params.search?.trim()) search.set('search', params.search.trim());
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** GET /admin/users — paginated, searchable user list. */
export async function listUsers(
  params: ListUsersParams = {},
): Promise<PaginatedUsers> {
  return apiRequest<PaginatedUsers>({
    method: 'GET',
    path: `/admin/users${buildQuery(params)}`,
    bearer: await bearer(),
  });
}

/** GET /admin/users/:id — user identity + parking memberships. */
export async function getUser(id: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>({
    method: 'GET',
    path: `/admin/users/${id}`,
    bearer: await bearer(),
  });
}

/** PATCH /admin/users/:id — change the global role (admin | user). */
export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<AdminUser> {
  return apiRequest<AdminUser>({
    method: 'PATCH',
    path: `/admin/users/${id}`,
    body: { role },
    bearer: await bearer(),
  });
}

/** DELETE /admin/users/:id — complete deletion (Auth + cascade). */
export async function deleteUser(id: string): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/admin/users/${id}`,
    bearer: await bearer(),
  });
}

/** POST /admin/users/:id/memberships — link a user to a parking lot. */
export async function addMembership(
  userId: string,
  body: CreateMembershipInput,
): Promise<AdminUserMembership> {
  return apiRequest<AdminUserMembership>({
    method: 'POST',
    path: `/admin/users/${userId}/memberships`,
    body,
    bearer: await bearer(),
  });
}

/** PATCH /admin/users/:id/memberships/:parkingId — change a membership role. */
export async function updateMembership(
  userId: string,
  parkingId: string,
  body: UpdateMembershipInput,
): Promise<AdminUserMembership> {
  return apiRequest<AdminUserMembership>({
    method: 'PATCH',
    path: `/admin/users/${userId}/memberships/${parkingId}`,
    body,
    bearer: await bearer(),
  });
}

/** DELETE /admin/users/:id/memberships/:parkingId — unlink from a parking. */
export async function removeMembership(
  userId: string,
  parkingId: string,
): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/admin/users/${userId}/memberships/${parkingId}`,
    bearer: await bearer(),
  });
}

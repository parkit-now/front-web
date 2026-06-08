import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Schedule = components['schemas']['ScheduleDto'];
export type CreateScheduleInput = components['schemas']['CreateScheduleDto'];
export type UpdateScheduleInput = components['schemas']['UpdateScheduleDto'];
export type ScheduleDay = Schedule['day'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/** GET /tenants/:tenantId/schedules — opening ranges of the active lot. */
export async function listSchedules(tenantId: string): Promise<Schedule[]> {
  return apiRequest<Schedule[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/schedules`,
    bearer: await bearer(),
  });
}

/** POST /tenants/:tenantId/schedules — owner-only, validates overlaps. */
export async function createSchedule(
  tenantId: string,
  body: CreateScheduleInput,
): Promise<Schedule> {
  return apiRequest<Schedule>({
    method: 'POST',
    path: `/tenants/${tenantId}/schedules`,
    body,
    bearer: await bearer(),
  });
}

/** PATCH /tenants/:tenantId/schedules/:id — owner-only, optimistic locking. */
export async function updateSchedule(
  tenantId: string,
  scheduleId: string,
  expectedVersion: number,
  body: UpdateScheduleInput,
): Promise<Schedule> {
  return apiRequest<Schedule>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/schedules/${scheduleId}?expectedVersion=${expectedVersion}`,
    body,
    bearer: await bearer(),
  });
}

/** DELETE /tenants/:tenantId/schedules/:id — owner-only, optimistic locking. */
export async function deleteSchedule(
  tenantId: string,
  scheduleId: string,
  expectedVersion: number,
): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/schedules/${scheduleId}?expectedVersion=${expectedVersion}`,
    bearer: await bearer(),
  });
}

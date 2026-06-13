import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type EntitySummary = components['schemas']['EntitySummaryDto'];
export type EntityProfile = components['schemas']['EntityProfileDto'];
export type EntityCapacity = components['schemas']['EntityCapacityDto'];
export type UpdateEntityProfileInput =
  components['schemas']['UpdateEntityProfileDto'];
export type PaymentMethodSummary =
  components['schemas']['PaymentMethodSummaryDto'];
export type TogglePaymentMethodInput =
  components['schemas']['TogglePaymentMethodDto'];
export type CreatePaymentMethodInput =
  components['schemas']['CreatePaymentMethodDto'];
export type MembershipRole = EntitySummary['role'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/** GET /tenants — the lots the caller belongs to (optionally filtered by role). */
export async function listMyEntities(
  role?: MembershipRole,
): Promise<EntitySummary[]> {
  const qs = role ? `?role=${role}` : '';
  return apiRequest<EntitySummary[]>({
    method: 'GET',
    path: `/tenants${qs}`,
    bearer: await bearer(),
  });
}

/** GET /tenants/:tenantId — full profile of one lot (incl. capacity). */
export async function getEntityProfile(
  tenantId: string,
): Promise<EntityProfile> {
  return apiRequest<EntityProfile>({
    method: 'GET',
    path: `/tenants/${tenantId}`,
    bearer: await bearer(),
  });
}

/** PATCH /tenants/:tenantId — owner-only edit of profile, status and capacity. */
export async function updateEntityProfile(
  tenantId: string,
  body: UpdateEntityProfileInput,
): Promise<EntityProfile> {
  return apiRequest<EntityProfile>({
    method: 'PATCH',
    path: `/tenants/${tenantId}`,
    body,
    bearer: await bearer(),
  });
}

/** GET /tenants/:tenantId/payment-methods — configured payment methods. */
export async function listPaymentMethods(
  tenantId: string,
): Promise<PaymentMethodSummary[]> {
  return apiRequest<PaymentMethodSummary[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/payment-methods`,
    bearer: await bearer(),
  });
}

/** POST /tenants/:tenantId/payment-methods — owner-only create custom method. */
export async function createPaymentMethod(
  tenantId: string,
  body: CreatePaymentMethodInput,
): Promise<PaymentMethodSummary> {
  return apiRequest<PaymentMethodSummary>({
    method: 'POST',
    path: `/tenants/${tenantId}/payment-methods`,
    body,
    bearer: await bearer(),
  });
}

/** PATCH /tenants/:tenantId/payment-methods/:id — owner-only enable/default/rename. */
export async function togglePaymentMethod(
  tenantId: string,
  paymentMethodId: string,
  body: TogglePaymentMethodInput,
): Promise<PaymentMethodSummary> {
  return apiRequest<PaymentMethodSummary>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/payment-methods/${paymentMethodId}`,
    body,
    bearer: await bearer(),
  });
}

/** DELETE /tenants/:tenantId/payment-methods/:id — owner-only, custom methods only. */
export async function deletePaymentMethod(
  tenantId: string,
  paymentMethodId: string,
): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/payment-methods/${paymentMethodId}`,
    bearer: await bearer(),
  });
}

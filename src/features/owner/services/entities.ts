import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type EntitySummary = components['schemas']['EntitySummaryDto'];
export type EntityCapacity = components['schemas']['EntityCapacityDto'];

/** Closed set of retention windows a lot can pick — mirrors the backend DTO/CHECK. */
export type LprImageRetentionDays = 30 | 60 | 90;

/**
 * TODO(sync-types): the backend `EntityProfileDto` / `UpdateEntityProfileDto`
 * already carry `lprImageRetentionDays` (owner-configurable, one of 30/60/90),
 * but the generated OpenAPI types are stale (generated against `develop`,
 * which doesn't have this backend PR yet). Drop this local extension once
 * `make sync-types` runs against a backend that has both this feature AND
 * everything currently on `develop` — running it against just this feature's
 * backend branch regresses unrelated types other files depend on.
 */
type LprRetentionFields = { lprImageRetentionDays: LprImageRetentionDays };

export type EntityProfile = components['schemas']['EntityProfileDto'] &
  LprRetentionFields;
export type UpdateEntityProfileInput =
  components['schemas']['UpdateEntityProfileDto'] & Partial<LprRetentionFields>;

/**
 * Privacy-by-design: a short, defensible default plus a handful of vetted
 * options, not a knob that lets an owner push the window to an arbitrary
 * ceiling with no documented reason.
 */
export const LPR_IMAGE_RETENTION_DAYS_OPTIONS: readonly LprImageRetentionDays[] =
  [30, 60, 90];
export const LPR_IMAGE_RETENTION_DAYS_DEFAULT: LprImageRetentionDays = 30;
export type PaymentMethodSummary =
  components['schemas']['PaymentMethodSummaryDto'];
/**
 * Qué ES el medio de pago, a diferencia de `name`, que es cómo lo llama el
 * dueño. `mercadopago_qr` es el que crea la integración al vincular la cuenta.
 */
export type PaymentMethodType = components['schemas']['PaymentMethodType'];
/**
 * Facturación al cobrar con este medio: `none` no factura, `auto` emite al
 * cobrar, `manual` deja la factura pendiente para el Historial. `auto`/`manual`
 * responden 409 `ARCA_NOT_LINKED` si la sede no tiene ARCA vinculada.
 */
export type PaymentMethodInvoiceMode =
  components['schemas']['PaymentMethodInvoiceMode'];
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

/**
 * PATCH /tenants/:tenantId — owner-only edit of profile, status, capacity and
 * the LPR image retention window (`lprImageRetentionDays`).
 */
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

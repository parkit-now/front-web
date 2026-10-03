import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type OwnerReservation = components['schemas']['OwnerReservationDto'];
export type OwnerReservationDetail =
  components['schemas']['OwnerReservationDetailDto'];
export type OwnerReservationPayment =
  components['schemas']['OwnerReservationPaymentDto'];
export type OwnerReservationPolicy =
  components['schemas']['OwnerReservationPolicyDto'];
export type ReservationStatus = components['schemas']['ReservationStatus'];
export type RefundStatus = OwnerReservation['refundStatus'];
export type PaginatedOwnerReservations =
  components['schemas']['PaginatedOwnerReservationsDto'];

/** Tope de página del backend: pedir más devuelve 400. */
export const RESERVATIONS_PAGE_SIZE = 100;

export type ListReservationsParams = {
  status?: ReservationStatus;
  /** ISO-8601 con offset. Filtra por `entryAt` (inclusive). */
  from?: string;
  to?: string;
  /** Patente (contiene). */
  q?: string;
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

const base = (tenantId: string) =>
  `/tenants/${encodeURIComponent(tenantId)}/reservations`;

/**
 * GET /tenants/:tenantId/reservations — una página. Cualquier miembro de la
 * playa (dueño u operador). Filtra por UN solo `status`: el backend no acepta
 * varios a la vez ni filtra por `refundStatus`.
 */
export async function listReservations(
  tenantId: string,
  params: ListReservationsParams = {},
): Promise<PaginatedOwnerReservations> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return apiRequest<PaginatedOwnerReservations>({
    method: 'GET',
    path: `${base(tenantId)}${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}

/**
 * Trae todas las páginas de un estado, hasta `maxItems`. Para los estados
 * "vivos" (por aceptar, próximas, en curso) hay que traer todo: una reserva
 * confirmada para dentro de una semana no puede quedar afuera por paginar.
 */
export async function listAllReservations(
  tenantId: string,
  params: Omit<ListReservationsParams, 'page' | 'pageSize'>,
  maxItems = 500,
): Promise<OwnerReservation[]> {
  const all: OwnerReservation[] = [];
  let page = 1;
  while (all.length < maxItems) {
    const res = await listReservations(tenantId, {
      ...params,
      page,
      pageSize: RESERVATIONS_PAGE_SIZE,
    });
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
    page += 1;
  }
  return all;
}

/** GET /tenants/:tenantId/reservations/:id — con los intentos de cobro. */
export async function getReservation(
  tenantId: string,
  reservationId: string,
): Promise<OwnerReservationDetail> {
  return apiRequest<OwnerReservationDetail>({
    method: 'GET',
    path: `${base(tenantId)}/${encodeURIComponent(reservationId)}`,
    bearer: await bearer(),
  });
}

async function post(
  tenantId: string,
  reservationId: string,
  action: string,
  body?: unknown,
): Promise<OwnerReservationDetail> {
  return apiRequest<OwnerReservationDetail>({
    method: 'POST',
    path: `${base(tenantId)}/${encodeURIComponent(reservationId)}/${action}`,
    body,
    bearer: await bearer(),
  });
}

/** POST …/accept — solo `pending_approval` y dentro del plazo. */
export function acceptReservation(tenantId: string, reservationId: string) {
  return post(tenantId, reservationId, 'accept');
}

/** POST …/reject — motivo obligatorio (lo ve el conductor); reembolso total. */
export function rejectReservation(
  tenantId: string,
  reservationId: string,
  reason: string,
) {
  return post(tenantId, reservationId, 'reject', { reason });
}

/** POST …/cancel — motivo obligatorio; reembolso siempre total. */
export function cancelReservation(
  tenantId: string,
  reservationId: string,
  reason: string,
) {
  return post(tenantId, reservationId, 'cancel', { reason });
}

/** POST …/refund/retry — solo con `refundStatus = failed`. */
export function retryReservationRefund(
  tenantId: string,
  reservationId: string,
) {
  return post(tenantId, reservationId, 'refund/retry');
}

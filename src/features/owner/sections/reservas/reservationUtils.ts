import { fmtMoney0 } from '../../../../shared/utils/fmt';
import {
  AR_TZ,
  arDayKey,
  shiftDayKey,
} from '../../../../shared/utils/ar-datetime';
import type {
  OwnerReservation,
  OwnerReservationPayment,
  OwnerReservationPolicy,
  RefundStatus,
  ReservationStatus,
} from '../../services/reservations';

export type ReservationTab = 'pending' | 'upcoming' | 'inProgress' | 'history';

export type ChipVariant = 'default' | 'brand' | 'ok' | 'err' | 'warn';

export interface Chip {
  label: string;
  variant: ChipVariant;
}

/** Estados que siguen vivos: se traen completos, sin paginar a medias. */
export const LIVE_STATUSES: ReservationStatus[] = [
  'pending_approval',
  'confirmed',
  'checked_in',
];

/**
 * Estados que van al Historial. `pending_payment` y `expired` quedan afuera a
 * propósito: son intentos de reserva que nunca se pagaron, el dueño no tiene
 * nada que hacer con ellos.
 */
export const HISTORY_STATUSES: ReservationStatus[] = [
  'completed',
  'cancelled',
  'rejected',
  'no_show',
];

/** En qué pestaña cae una reserva; `null` si el dueño no la ve. */
export function tabOf(
  r: Pick<OwnerReservation, 'status'>,
): ReservationTab | null {
  switch (r.status) {
    case 'pending_approval':
      return 'pending';
    case 'confirmed':
      return 'upcoming';
    case 'checked_in':
      return 'inProgress';
    case 'completed':
    case 'cancelled':
    case 'rejected':
    case 'no_show':
      return 'history';
    default:
      return null;
  }
}

/** Códigos que el sistema guarda en `reason` cuando nadie escribió un motivo. */
const SYSTEM_REASONS: Record<string, string> = {
  approval_timeout: 'No respondiste a tiempo',
  late_payment_no_capacity: 'El pago llegó tarde y ya no había lugar',
};

/** El motivo para mostrar: un código del sistema se traduce, un texto libre no. */
export function reasonLabel(
  r: Pick<OwnerReservation, 'reason'>,
): string | null {
  if (!r.reason) return null;
  return SYSTEM_REASONS[r.reason] ?? r.reason;
}

export function statusChip(
  r: Pick<OwnerReservation, 'status' | 'cancelledBy' | 'reason'>,
): Chip {
  switch (r.status) {
    case 'pending_approval':
      return { label: 'Por aceptar', variant: 'warn' };
    case 'confirmed':
      return { label: 'Confirmada', variant: 'ok' };
    case 'checked_in':
      return { label: 'En curso', variant: 'brand' };
    case 'completed':
      return { label: 'Completada', variant: 'default' };
    case 'no_show':
      return { label: 'No se presentó', variant: 'default' };
    case 'rejected':
      return r.cancelledBy === 'system'
        ? { label: 'Vencida sin respuesta', variant: 'default' }
        : { label: 'Rechazada', variant: 'default' };
    case 'cancelled':
      if (r.cancelledBy === 'owner')
        return { label: 'Cancelada · vos', variant: 'default' };
      if (r.cancelledBy === 'driver')
        return { label: 'Cancelada · conductor', variant: 'default' };
      return { label: 'Cancelada · sistema', variant: 'default' };
    case 'expired':
      return { label: 'Vencida sin pago', variant: 'default' };
    case 'pending_payment':
      return { label: 'Esperando pago', variant: 'default' };
  }
}

/**
 * Chip de reembolso. `null` cuando no hay nada para decir ("—"). Un no-show o
 * una cancelación del conductor sin reembolso dicen "Sin reembolso": la política
 * lo permite y el dueño tiene que poder verlo.
 */
export function refundChip(
  r: Pick<OwnerReservation, 'status' | 'cancelledBy' | 'refundStatus'>,
): Chip | null {
  switch (r.refundStatus) {
    case 'refunded':
      return { label: 'Reembolsada', variant: 'ok' };
    case 'partial':
      return { label: 'Reembolso parcial', variant: 'ok' };
    case 'pending':
      return { label: 'Reembolso en curso', variant: 'warn' };
    case 'failed':
      return { label: 'Reembolso fallido', variant: 'err' };
    case 'none':
      if (
        r.status === 'no_show' ||
        (r.status === 'cancelled' && r.cancelledBy === 'driver')
      ) {
        return { label: 'Sin reembolso', variant: 'default' };
      }
      return null;
  }
}

export type ReservationAction = 'accept' | 'reject' | 'cancel' | 'retryRefund';

/**
 * Qué puede hacer el dueño con la reserva (la tabla del handoff). Las acciones
 * son por estado y NO por rol: el backend deja actuar al dueño y al operador.
 * Aceptar se esconde pasado el plazo: el backend contesta
 * `RESERVATION_APPROVAL_EXPIRED` y el barrido la rechaza solo.
 */
export function availableActions(
  r: Pick<OwnerReservation, 'status' | 'refundStatus' | 'approvalDeadlineAt'>,
  now: number = Date.now(),
): ReservationAction[] {
  const actions: ReservationAction[] = [];
  if (r.status === 'pending_approval') {
    if (!isApprovalExpired(r.approvalDeadlineAt, now)) actions.push('accept');
    actions.push('reject');
  } else if (r.status === 'confirmed') {
    actions.push('cancel');
  }
  if (r.refundStatus === 'failed') actions.push('retryRefund');
  return actions;
}

export function isApprovalExpired(
  deadlineAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!deadlineAt) return false;
  return new Date(deadlineAt).getTime() <= now;
}

export interface Countdown {
  /** `mm:ss` (o `h:mm:ss` si queda más de una hora). */
  label: string;
  remainingMs: number;
  expired: boolean;
  /** Quedan menos de 3 minutos: se pinta en rojo. */
  urgent: boolean;
}

const URGENT_MS = 3 * 60_000;

/** Cuenta regresiva hasta `approvalDeadlineAt`. `null` si no hay plazo. */
export function countdownTo(
  deadlineAt: string | null,
  now: number = Date.now(),
): Countdown | null {
  if (!deadlineAt) return null;
  const remainingMs = new Date(deadlineAt).getTime() - now;
  if (Number.isNaN(remainingMs)) return null;
  if (remainingMs <= 0) {
    return { label: '00:00', remainingMs: 0, expired: true, urgent: true };
  }
  // Se redondea hacia arriba: "00:00" solo se ve cuando ya venció de verdad.
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return {
    label,
    remainingMs,
    expired: false,
    urgent: remainingMs < URGENT_MS,
  };
}

const TIME = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: AR_TZ,
});

/** "Hoy 18:00–21:00", "Mañana 09:00–12:00", "05/10 18:00–21:00". */
export function formatSlot(
  entryAt: string,
  exitAt: string,
  now: Date = new Date(),
): string {
  const entry = new Date(entryAt);
  const exit = new Date(exitAt);
  const today = arDayKey(now);
  const entryDay = arDayKey(entry);
  const exitDay = arDayKey(exit);
  const dayLabel = (day: string) =>
    day === today
      ? 'Hoy'
      : day === shiftDayKey(today, 1)
        ? 'Mañana'
        : `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  const head = dayLabel(entryDay);
  if (entryDay === exitDay) {
    return `${head} ${TIME.format(entry)}–${TIME.format(exit)}`;
  }
  return `${head} ${TIME.format(entry)} – ${dayLabel(exitDay)} ${TIME.format(exit)}`;
}

/** Reembolsos que el dueño tiene que atender (hay que reintentarlos). */
export function failedRefunds(
  reservations: readonly Pick<OwnerReservation, 'refundStatus'>[],
): number {
  return reservations.filter((r) => r.refundStatus === 'failed').length;
}

export interface RefundFailureExplanation {
  title: string;
  /** Lo que tiene que hacer el dueño. */
  action: string;
}

/**
 * Explica por qué falló el reembolso. `refundError` es el texto crudo del
 * proveedor (en inglés, técnico): no se le muestra tal cual al dueño. El caso
 * típico es la cuenta de MP sin saldo (de ahí sale el reembolso).
 */
export function explainRefundFailure(
  refundError: string | null,
  amountArs?: number,
): RefundFailureExplanation {
  const text = (refundError ?? '').toLowerCase();
  const amount = amountArs === undefined ? '' : ` (${fmtMoney0(amountArs)})`;
  if (
    /token|unauthori[sz]ed|forbidden|revoked|expired|vencid|\b40[13]\b/.test(
      text,
    )
  ) {
    return {
      title: 'Parkit perdió la conexión con tu cuenta de Mercado Pago.',
      action:
        'Volvé a vincularla desde Integraciones y después reintentá el reembolso.',
    };
  }
  if (/saldo|insufficient|balance|funds|not enough/.test(text)) {
    return {
      title: `Tu cuenta de Mercado Pago no tiene saldo suficiente${amount}.`,
      action: 'Cargá saldo y reintentá.',
    };
  }
  return {
    title: `Mercado Pago no pudo hacer el reembolso${amount}.`,
    action:
      'Revisá que tu cuenta tenga saldo y esté vinculada, y reintentá. Si sigue fallando, contactanos.',
  };
}

/** Cuenta de reservas por pestaña, para los contadores de las pestañas. */
export function countByTab(
  reservations: readonly Pick<OwnerReservation, 'status'>[],
): Record<ReservationTab, number> {
  const counts: Record<ReservationTab, number> = {
    pending: 0,
    upcoming: 0,
    inProgress: 0,
    history: 0,
  };
  for (const r of reservations) {
    const tab = tabOf(r);
    if (tab) counts[tab] += 1;
  }
  return counts;
}

/** Reembolso que se le devuelve al conductor al rechazar o cancelar: siempre el total. */
export function fullRefundArs(r: Pick<OwnerReservation, 'totalArs'>): number {
  return r.totalArs;
}

export type { RefundStatus };

/** Lo que cobró Mercado Pago por la reserva (el intento aprobado más nuevo). */
export function paidAmountArs(
  payments: readonly Pick<OwnerReservationPayment, 'status' | 'amountArs'>[],
): number | null {
  const paid = payments.find((p) =>
    ['approved', 'refunded', 'partially_refunded'].includes(p.status),
  );
  return paid ? paid.amountArs : null;
}

/** La política que tenía la reserva al momento de reservar, en frases. */
export function policyLines(policy: OwnerReservationPolicy): string[] {
  const late =
    policy.lateCancelRefundPct > 0
      ? `si cancela más tarde, se le devuelve el ${policy.lateCancelRefundPct} %`
      : 'si cancela más tarde, no se le devuelve nada';
  return [
    `Cancelación gratis hasta ${policy.freeCancelMinutes} min antes; ${late}.`,
    `Puede llegar hasta ${policy.earlyArrivalMinutes} min antes y tiene ${policy.graceMinutes} min de tolerancia.`,
    policy.acceptanceMode === 'manual'
      ? `Aceptación manual: ${policy.approvalWindowMinutes} min para responder.`
      : 'Aceptación automática.',
  ];
}

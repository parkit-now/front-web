import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import type { AuditEvent, AuditSeverity } from '../../services/audit';

export type AuditActionKind =
  | 'entry.corrected'
  | 'entry.deleted'
  | 'entry.undercharged'
  | 'invoice.cert_expired'
  | 'other';

export type AuditOrigin =
  | 'history'
  | 'operational_exit'
  | 'desktop'
  | 'unknown';

export type PaymentSnapshot = {
  id?: string;
  paymentMethodId?: string | null;
  paymentMethodName: string;
  amount: number;
};

export type EntrySnapshot = {
  id?: string;
  plate?: string;
  color?: string | null;
  cochera?: string | null;
  notes?: string | null;
  enteredAt?: string;
  leftAt?: string | null;
  amountPaid?: number | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  rateId?: string | null;
  rateSnapshotName?: string | null;
  rateSnapshotHourPriceArs?: number | null;
  rateSnapshotStayPriceArs?: number | null;
  rateSnapshotFractionPriceArs?: number | null;
  cashSessionId?: string | null;
  ticketNumber?: number | null;
  payments?: PaymentSnapshot[];
};

export type AuditRow = {
  id: string;
  action: string;
  actionLabel: string;
  actionKind: AuditActionKind;
  actorName: string;
  actorRole: string;
  cashSessionId: string;
  changedFields: string[];
  changedFieldLabels: string[];
  colors: string[];
  createdAt: string;
  createdAtLocalDate: string;
  economicImpact: AuditEconomicImpact | null;
  enteredAt: string | undefined;
  enteredAtLocalDate: string;
  entityId: string | null;
  entityType: string;
  impactAmount: number | null;
  isActiveEntry: boolean;
  leftAt: string | null | undefined;
  leftAtLocalDate: string;
  metadata: Record<string, unknown>;
  moneyImpact: string;
  origin: AuditOrigin;
  originLabel: string;
  paymentMethodNames: string[];
  plate: string;
  rateNames: string[];
  reason: string;
  searchText: string;
  severity: AuditSeverity;
  summary: string;
  ticketNumber: string;
  vehicleBrands: string[];
  vehicleModels: string[];
};

export type AuditComparisonRow = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
};

export type AuditEconomicImpact = {
  suggestedBefore: number | null;
  suggestedAfter: number | null;
  suggestedDelta: number | null;
  chargedBefore: number | null;
  chargedAfter: number | null;
  chargedDelta: number | null;
  deltaVsSuggestedAfter: number | null;
};

const FIELD_LABELS: Record<string, string> = {
  plate: 'Patente',
  color: 'Color',
  cochera: 'Cochera',
  notes: 'Notas',
  enteredAt: 'Ingreso',
  leftAt: 'Egreso',
  amountPaid: 'Total cobrado',
  vehicleBrand: 'Marca',
  vehicleModel: 'Modelo',
  rateId: 'Tarifa',
  rateSnapshotName: 'Tarifa',
  rateSnapshotHourPriceArs: 'Tarifa',
  rateSnapshotStayPriceArs: 'Tarifa',
  rateSnapshotFractionPriceArs: 'Tarifa',
  payments: 'Pagos',
};

const RATE_FIELDS = new Set([
  'rateId',
  'rateSnapshotName',
  'rateSnapshotHourPriceArs',
  'rateSnapshotStayPriceArs',
  'rateSnapshotFractionPriceArs',
]);

const DISPLAY_FIELDS: Array<keyof EntrySnapshot> = [
  'plate',
  'enteredAt',
  'leftAt',
  'rateSnapshotName',
  'amountPaid',
  'payments',
];

const NON_OWNER_AUDIT_CORRECTION_FIELDS = new Set(['color', 'notes']);

/** Acciones sobre reservas (backend: `reservation.*`). */
const RESERVATION_AUDIT_ACTIONS = [
  'reservation.accepted',
  'reservation.rejected',
  'reservation.cancelled',
  'reservation.refund_retried',
  'reservation.refund_confirmed',
  'reservation.refund_failed',
  'reservation.late_payment_refunded',
] as const;

const OWNER_AUDIT_VISIBLE_ACTIONS = new Set<string>([
  'entry.corrected',
  'entry.deleted',
  'entry.undercharged',
  'invoice.cert_expired',
  'arca_account.certificate_expired',
  'arca_account.renewal_prepared',
  'mp_account.link_failed',
  'mp_account.token_expired',
  'payment_intent.cancel_mp_failed',
  'payment_intent.refunded',
  'entry.reservation_unlinked',
  ...RESERVATION_AUDIT_ACTIONS,
]);

const KNOWN_AUDIT_ACTIONS = new Set<string>([
  'application.created',
  'application.updated',
  'application.submitted',
  'application.document_added',
  'application.rejected',
  'user.promoted_to_owner',
  'entity.approved',
  'entity.rejected',
  'entity.profile_updated',
  'payment_method.toggled',
  'entry.corrected',
  'entry.deleted',
  'rate.prices_propagated',
  'entry.undercharged',
  'entry.reservation_unlinked',
  'lpr_event.registered',
  'lpr_event.dismissed',
  'lpr_event.suppressed',
  'lpr_event.archived',
  'lpr_event.unarchived',
  'lpr_event.image_purged',
  'parking.created',
  'parking.updated',
  'parking.deleted',
  'user.role_updated',
  'user.deleted',
  'membership.created',
  'membership.updated',
  'membership.deleted',
  'mp_account.linked',
  'mp_account.unlinked',
  'mp_account.link_failed',
  'arca_account.linked',
  'arca_account.unlinked',
  'arca_account.renewal_prepared',
  'arca_account.certificate_renewed',
  'arca_account.certificate_expired',
  'invoice.cert_expired',
  'mp_account.token_refreshed',
  'mp_account.token_expired',
  'payment_intent.cancel_mp_failed',
  'payment_intent.refunded',
  ...RESERVATION_AUDIT_ACTIONS,
]);

function isExcludedOwnerAuditAction(action: string): boolean {
  return action === 'rate.prices_propagated' || action.startsWith('lpr_event.');
}

export function isOwnerAuditVisible(action: string): boolean {
  if (isExcludedOwnerAuditAction(action)) return false;
  if (OWNER_AUDIT_VISIBLE_ACTIONS.has(action)) return true;
  return !KNOWN_AUDIT_ACTIONS.has(action);
}

function hasOwnerVisibleCorrectionChange(event: AuditEvent): boolean {
  if (event.action !== 'entry.corrected') return true;
  const changedFields = readStringArray(
    metadataRecord(event.metadata),
    'changedFields',
  );
  if (changedFields.length === 0) return true;
  return changedFields.some(
    (field) => !NON_OWNER_AUDIT_CORRECTION_FIELDS.has(field),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readSnapshot(
  record: Record<string, unknown>,
  key: 'before' | 'after',
): EntrySnapshot {
  const value = record[key];
  if (!isRecord(value)) return {};

  const payments = Array.isArray(value.payments)
    ? value.payments.flatMap((item): PaymentSnapshot[] => {
        if (!isRecord(item)) return [];
        const amount = readNumber(item, 'amount');
        return [
          {
            id: readString(item, 'id') || undefined,
            paymentMethodId: readString(item, 'paymentMethodId') || null,
            paymentMethodName: readString(item, 'paymentMethodName') || 'Pago',
            amount: amount ?? 0,
          },
        ];
      })
    : undefined;

  return {
    id: readString(value, 'id') || undefined,
    plate: readString(value, 'plate') || undefined,
    color: readNullableString(value, 'color'),
    cochera: readNullableString(value, 'cochera'),
    notes: readNullableString(value, 'notes'),
    enteredAt: readString(value, 'enteredAt') || undefined,
    leftAt: readNullableString(value, 'leftAt'),
    amountPaid: readNumber(value, 'amountPaid'),
    vehicleBrand: readNullableString(value, 'vehicleBrand'),
    vehicleModel: readNullableString(value, 'vehicleModel'),
    rateId: readNullableString(value, 'rateId'),
    rateSnapshotName: readNullableString(value, 'rateSnapshotName'),
    rateSnapshotHourPriceArs: readNumber(value, 'rateSnapshotHourPriceArs'),
    rateSnapshotStayPriceArs: readNumber(value, 'rateSnapshotStayPriceArs'),
    rateSnapshotFractionPriceArs: readNumber(
      value,
      'rateSnapshotFractionPriceArs',
    ),
    cashSessionId: readNullableString(value, 'cashSessionId'),
    ticketNumber: readNumber(value, 'ticketNumber'),
    payments,
  };
}

function readEconomicImpact(
  metadata: Record<string, unknown>,
): AuditEconomicImpact | null {
  const value = metadata.economicImpact;
  if (!isRecord(value)) return null;
  const impact = {
    suggestedBefore: readNumber(value, 'suggestedBefore'),
    suggestedAfter: readNumber(value, 'suggestedAfter'),
    suggestedDelta: readNumber(value, 'suggestedDelta'),
    chargedBefore: readNumber(value, 'chargedBefore'),
    chargedAfter: readNumber(value, 'chargedAfter'),
    chargedDelta: readNumber(value, 'chargedDelta'),
    deltaVsSuggestedAfter: readNumber(value, 'deltaVsSuggestedAfter'),
  };
  return Object.values(impact).some((item) => item !== null) ? impact : null;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'string' ? value : null;
}

function readOrigin(record: Record<string, unknown>): AuditOrigin {
  const origin = readString(record, 'origin');
  if (
    origin === 'history' ||
    origin === 'operational_exit' ||
    origin === 'desktop'
  )
    return origin;
  return 'unknown';
}

function dateKeyAr(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function maybeDateKeyAr(value: string | null | undefined): string {
  return value ? dateKeyAr(value) : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

function snapshotValues(
  before: EntrySnapshot,
  after: EntrySnapshot,
  key: keyof EntrySnapshot,
): string[] {
  const afterValue = after[key];
  const beforeValue = before[key];
  return uniqueStrings([
    typeof afterValue === 'string' ? afterValue : null,
    typeof beforeValue === 'string' ? beforeValue : null,
  ]);
}

function paymentMethodNames(
  before: EntrySnapshot,
  after: EntrySnapshot,
): string[] {
  return uniqueStrings([
    ...(after.payments ?? []).map((payment) => payment.paymentMethodName),
    ...(before.payments ?? []).map((payment) => payment.paymentMethodName),
  ]);
}

export function actionKindFor(action: string): AuditActionKind {
  if (action === 'entry.corrected') return 'entry.corrected';
  if (action === 'entry.deleted') return 'entry.deleted';
  if (action === 'entry.undercharged') return 'entry.undercharged';
  if (action === 'invoice.cert_expired') return 'invoice.cert_expired';
  return 'other';
}

/** Acciones visibles sin vista propia, normalizadas para dueño. */
const OTHER_ACTION_LABELS: Record<string, string> = {
  'arca_account.renewal_prepared': 'Renovación de ARCA pendiente',
  'arca_account.certificate_expired': 'Certificado de ARCA vencido',
  'mp_account.link_failed': 'Falló la vinculación de Mercado Pago',
  'mp_account.token_expired': 'Mercado Pago desvinculado por token vencido',
  'payment_intent.cancel_mp_failed':
    'No se pudo cancelar una orden de Mercado Pago',
  'payment_intent.refunded': 'Pago devuelto por Mercado Pago',
  'reservation.accepted': 'Reserva aceptada',
  'reservation.rejected': 'Reserva rechazada',
  'reservation.cancelled': 'Reserva cancelada',
  'reservation.refund_retried': 'Reembolso reintentado',
  'reservation.refund_confirmed': 'Reembolso confirmado',
  'reservation.refund_failed': 'Reembolso fallido',
  'reservation.late_payment_refunded': 'Pago tardío reembolsado',
  'entry.reservation_unlinked': 'Reserva desvinculada en la caja',
};

/** Quién actuó, según `metadata.actorRole`. */
const ACTOR_ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  operator: 'Operador',
  admin: 'Administrador',
  driver: 'Conductor',
  system: 'Sistema',
};

export function actorRoleLabel(role: string): string {
  return ACTOR_ROLE_LABELS[role] ?? role;
}

/** Motivos fijos que escribe el sistema (`metadata.reasonCode`). */
const REASON_CODE_LABELS: Record<string, string> = {
  approval_timeout: 'Venció el plazo para responder',
  late_payment_no_capacity: 'Pago tardío sin cupo disponible',
  payment_after_cancel: 'Pago recibido con la reserva ya cancelada',
};

function isReservationAction(action: string): boolean {
  return action.startsWith('reservation.');
}

function reservationReason(metadata: Record<string, unknown>): string {
  const reason = readString(metadata, 'reason');
  if (reason) return reason;
  const code = readString(metadata, 'reasonCode');
  return code ? (REASON_CODE_LABELS[code] ?? code.replaceAll('_', ' ')) : '';
}

function reservationSummary(
  action: string,
  metadata: Record<string, unknown>,
): string {
  const plate = readString(metadata, 'vehiclePlate');
  const who = actorRoleLabel(readString(metadata, 'actorRole') || 'system');
  const suffix = plate ? ` de ${plate}` : '';
  if (action === 'reservation.accepted') {
    return `${who} aceptó la reserva${suffix}`;
  }
  if (action === 'reservation.rejected') {
    return `${who} rechazó la reserva${suffix}`;
  }
  if (action === 'reservation.cancelled') {
    const role = readString(metadata, 'actorRole');
    // Cancelación del lado del estacionamiento (dueño/operador/admin): el
    // backend la marca como advertencia, y se dice así de claro.
    if (role === 'owner' || role === 'operator' || role === 'admin') {
      return `Reserva${suffix} cancelada por el estacionamiento (${who})`;
    }
    return `${who} canceló la reserva${suffix}`;
  }
  if (action === 'reservation.refund_retried') {
    return `${who} reintentó el reembolso de la reserva${suffix}`;
  }
  if (action === 'reservation.refund_failed') {
    return `No se pudo reembolsar la reserva${suffix}`;
  }
  return `Se reembolsó un pago tardío de la reserva${suffix}`;
}

export function actionLabelFor(action: string): string {
  if (action === 'entry.corrected') return 'Corrección de estadía';
  if (action === 'entry.deleted') return 'Ingreso eliminado';
  if (action === 'entry.undercharged') return 'Cobro menor al sugerido';
  if (action === 'invoice.cert_expired') return 'Cobro sin factura';
  return OTHER_ACTION_LABELS[action] ?? 'Evento del sistema';
}

function certExpiredSummary(metadata: Record<string, unknown>): string {
  const plate = readString(metadata, 'plate');
  const prefix = plate ? `Cobro sin factura en ${plate}` : 'Cobro sin factura';
  return `${prefix}: certificado de ARCA vencido`;
}

function actionSummaryFor(
  action: string,
  metadata: Record<string, unknown>,
): string {
  if (action === 'entry.deleted') {
    const plate = readString(metadata, 'plate');
    const ticket = readNumber(metadata, 'ticketNumber');
    return `Ingreso eliminado${plate ? ` de ${plate}` : ''}${ticket === null ? '' : ` (ticket ${ticket})`}`;
  }
  if (action === 'arca_account.certificate_expired') {
    return 'El certificado de ARCA venció y la playa no puede facturar';
  }
  if (action === 'arca_account.renewal_prepared') {
    return 'La renovación del certificado de ARCA quedó lista para completar';
  }
  if (action === 'mp_account.link_failed') {
    return 'No se pudo vincular la cuenta de Mercado Pago';
  }
  if (action === 'mp_account.token_expired') {
    return 'Mercado Pago requiere revinculación para seguir cobrando';
  }
  if (action === 'payment_intent.cancel_mp_failed') {
    return 'Mercado Pago no aceptó cancelar una orden pendiente';
  }
  if (isReservationAction(action)) {
    return reservationSummary(action, metadata);
  }
  if (action === 'entry.reservation_unlinked') {
    // Fase 6c: la caja dejó el ingreso como estadía común; se cobra todo.
    const who = actorRoleLabel(readString(metadata, 'actorRole') || 'system');
    const plate = readString(metadata, 'plate');
    const code = readString(metadata, 'reservationCode');
    const prepaid = readNumber(metadata, 'prepaidAmount');
    return `${who} desvinculó la reserva${code ? ` ${code}` : ''}${plate ? ` de ${plate}` : ''}: se cobra la estadía completa${prepaid ? ` (había pagado ${fmtMoney0(prepaid)})` : ''}`;
  }
  if (action === 'payment_intent.refunded') {
    const amount = readNumber(metadata, 'amount');
    return amount === null
      ? 'Mercado Pago devolvió un cobro'
      : `Mercado Pago devolvió ${fmtMoney0(amount)}`;
  }
  return actionLabelFor(action);
}

export function originLabelFor(origin: AuditOrigin): string {
  if (origin === 'history') return 'Historial';
  if (origin === 'operational_exit') return 'Panel operativo';
  if (origin === 'desktop') return 'Aplicación desktop';
  return 'Sin origen';
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function changedFieldLabels(fields: string[]): string[] {
  const labels: string[] = [];
  for (const field of fields) {
    const label = RATE_FIELDS.has(field) ? 'Tarifa' : fieldLabel(field);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

function displayFieldValue(
  field: keyof EntrySnapshot,
  snapshot: EntrySnapshot,
): string {
  const value = snapshot[field];
  if (field === 'enteredAt' || field === 'leftAt') {
    return typeof value === 'string' && value ? fmtDateTimeAr(value) : '-';
  }
  if (
    field === 'amountPaid' ||
    field === 'rateSnapshotHourPriceArs' ||
    field === 'rateSnapshotStayPriceArs' ||
    field === 'rateSnapshotFractionPriceArs'
  ) {
    return typeof value === 'number' ? fmtMoney0(value) : '-';
  }
  if (field === 'payments') {
    return paymentListLabel(snapshot.payments);
  }
  if (value === null || value === undefined || value === '') return '-';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

export function paymentListLabel(payments?: PaymentSnapshot[]): string {
  if (!payments?.length) return '-';
  return payments
    .map(
      (payment) => `${payment.paymentMethodName}: ${fmtMoney0(payment.amount)}`,
    )
    .join(' · ');
}

function fmtSignedMoney0(value: number): string {
  if (Math.abs(value) <= 0.005) return fmtMoney0(0);
  return `${value > 0 ? '+' : '-'}${fmtMoney0(Math.abs(value))}`;
}

function amountTotal(snapshot: EntrySnapshot): number | null {
  if (typeof snapshot.amountPaid === 'number') return snapshot.amountPaid;
  if (!snapshot.payments?.length) return null;
  return snapshot.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function correctionSummary(
  metadata: Record<string, unknown>,
  before: EntrySnapshot,
  after: EntrySnapshot,
  changedFields: string[],
): string {
  const plate = after.plate ?? before.plate ?? readString(metadata, 'plate');
  const labels = changedFieldLabels(changedFields);
  const fields =
    labels.length === 0
      ? 'sin campos detectados'
      : labels.slice(0, 4).join(', ') + (labels.length > 4 ? '...' : '');
  return `Corrección${plate ? ` de ${plate}` : ''}: ${fields}`;
}

function underchargeSummary(metadata: Record<string, unknown>): string {
  const plate = readString(metadata, 'plate');
  const suggested = readNumber(metadata, 'suggestedAmount');
  const charged = readNumber(metadata, 'chargedAmount');
  const percent =
    suggested && charged !== null
      ? Math.round((charged / suggested) * 100)
      : null;
  const prefix = plate ? `Cobro bajo en ${plate}` : 'Cobro menor al sugerido';
  return percent === null ? prefix : `${prefix}: ${percent}% del sugerido`;
}

function moneyImpactFor(
  action: string,
  metadata: Record<string, unknown>,
  before: EntrySnapshot,
  after: EntrySnapshot,
): { label: string; amount: number | null } {
  if (action === 'entry.deleted') {
    const amount = readNumber(metadata, 'amountPaid');
    return amount !== null && amount > 0
      ? { label: `Retirado de caja ${fmtMoney0(amount)}`, amount: -amount }
      : { label: 'Sin cobro', amount: 0 };
  }
  if (action === 'entry.undercharged') {
    const delta = readNumber(metadata, 'delta');
    return {
      label: delta === null ? '-' : `Diferencia ${fmtMoney0(delta)}`,
      amount: delta,
    };
  }

  if (action === 'invoice.cert_expired') {
    // No es plata perdida (se cobró): es plata sin comprobante. No suma a la
    // pérdida posible, sólo se muestra.
    const charged = readNumber(metadata, 'chargedAmount');
    return {
      label: charged === null ? '-' : `Sin facturar ${fmtMoney0(charged)}`,
      amount: null,
    };
  }

  if (isReservationAction(action)) {
    // Plata que se devuelve al conductor: se muestra, no suma a ninguna pérdida.
    const refund = readNumber(metadata, 'refundArs');
    return {
      label:
        refund === null || refund <= 0 ? '-' : `Reembolso ${fmtMoney0(refund)}`,
      amount: null,
    };
  }

  if (action === 'entry.corrected') {
    const economicImpact = readEconomicImpact(metadata);
    if (
      economicImpact?.chargedDelta !== null &&
      economicImpact?.chargedDelta !== undefined &&
      Math.abs(economicImpact.chargedDelta) > 0.005
    ) {
      const chargedBefore = economicImpact.chargedBefore;
      const chargedAfter = economicImpact.chargedAfter;
      return {
        label:
          chargedBefore !== null && chargedAfter !== null
            ? `Cobrado ${fmtMoney0(chargedBefore)} -> ${fmtMoney0(chargedAfter)}`
            : `Cobrado ${fmtSignedMoney0(economicImpact.chargedDelta)}`,
        amount: economicImpact.chargedDelta,
      };
    }

    const beforeTotal = amountTotal(before);
    const afterTotal = amountTotal(after);
    if (
      beforeTotal !== null &&
      afterTotal !== null &&
      beforeTotal !== afterTotal
    ) {
      return {
        label: `Cobrado ${fmtMoney0(beforeTotal)} -> ${fmtMoney0(afterTotal)}`,
        amount: afterTotal - beforeTotal,
      };
    }
  }

  return { label: '-', amount: null };
}

export function buildAuditRow(event: AuditEvent): AuditRow {
  const metadata = metadataRecord(event.metadata);
  const before = readSnapshot(metadata, 'before');
  const after = readSnapshot(metadata, 'after');
  const changedFields = readStringArray(metadata, 'changedFields');
  const labels = changedFieldLabels(changedFields);
  const origin =
    event.action === 'entry.deleted' && !readString(metadata, 'origin')
      ? 'desktop'
      : readOrigin(metadata);
  const kind = actionKindFor(event.action);
  const plate =
    after.plate ??
    before.plate ??
    (readString(metadata, 'plate') || readString(metadata, 'vehiclePlate'));
  const ticket =
    after.ticketNumber ??
    before.ticketNumber ??
    readNumber(metadata, 'ticketNumber');
  const moneyImpact = moneyImpactFor(event.action, metadata, before, after);
  const economicImpact = readEconomicImpact(metadata);
  const reason = isReservationAction(event.action)
    ? reservationReason(metadata)
    : readString(metadata, 'reason');
  const actorRole = actorRoleLabel(
    readString(metadata, 'actorRole') ||
      (event.action === 'entry.deleted' ? 'owner' : ''),
  );
  const cashSessionId =
    after.cashSessionId ??
    before.cashSessionId ??
    readString(metadata, 'cashSessionId');
  const summary =
    event.action === 'entry.corrected'
      ? correctionSummary(metadata, before, after, changedFields)
      : event.action === 'entry.undercharged'
        ? underchargeSummary(metadata)
        : event.action === 'invoice.cert_expired'
          ? certExpiredSummary(metadata)
          : actionSummaryFor(event.action, metadata);
  const rateNames = snapshotValues(before, after, 'rateSnapshotName');
  const vehicleBrands = snapshotValues(before, after, 'vehicleBrand');
  const vehicleModels = snapshotValues(before, after, 'vehicleModel');
  const colors = snapshotValues(before, after, 'color');
  const paymentMethods = paymentMethodNames(before, after);
  const knownLeftAt = after.leftAt ?? before.leftAt;
  const isActiveEntry = kind === 'entry.corrected' && knownLeftAt === null;

  return {
    id: event.id,
    action: event.action,
    actionLabel: actionLabelFor(event.action),
    actionKind: kind,
    actorName: event.actorName ?? 'Sistema',
    actorRole: actorRole || '-',
    cashSessionId: cashSessionId || '-',
    changedFields,
    changedFieldLabels: labels,
    colors,
    createdAt: event.createdAt,
    createdAtLocalDate: dateKeyAr(event.createdAt),
    economicImpact,
    enteredAt: after.enteredAt ?? before.enteredAt,
    enteredAtLocalDate: maybeDateKeyAr(after.enteredAt ?? before.enteredAt),
    entityId: event.entityId,
    entityType: event.entityType,
    impactAmount: moneyImpact.amount,
    isActiveEntry,
    leftAt: after.leftAt ?? before.leftAt,
    leftAtLocalDate: maybeDateKeyAr(after.leftAt ?? before.leftAt),
    metadata,
    moneyImpact: moneyImpact.label,
    origin,
    originLabel: originLabelFor(origin),
    paymentMethodNames: paymentMethods,
    plate: plate || '-',
    rateNames,
    reason: reason || '-',
    searchText: [
      event.action,
      actionLabelFor(event.action),
      event.actorName,
      actorRole,
      plate,
      ticket,
      reason,
      changedFields.join(' '),
      labels.join(' '),
      originLabelFor(origin),
      rateNames.join(' '),
      vehicleBrands.join(' '),
      vehicleModels.join(' '),
      colors.join(' '),
      paymentMethods.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
    severity: event.severity,
    summary,
    ticketNumber:
      ticket === null || ticket === undefined ? '-' : String(ticket),
    vehicleBrands,
    vehicleModels,
  };
}

export function buildAuditRows(events: AuditEvent[]): AuditRow[] {
  return events.map(buildAuditRow);
}

export function buildOwnerAuditRows(events: AuditEvent[]): AuditRow[] {
  return events
    .filter(
      (event) =>
        isOwnerAuditVisible(event.action) &&
        hasOwnerVisibleCorrectionChange(event),
    )
    .map(buildAuditRow);
}

export function correctionComparisons(row: AuditRow): AuditComparisonRow[] {
  const before = readSnapshot(row.metadata, 'before');
  const after = readSnapshot(row.metadata, 'after');
  const changed = new Set(row.changedFields);

  return DISPLAY_FIELDS.map((field) => ({
    field: fieldLabel(field),
    before: displayFieldValue(field, before),
    after: displayFieldValue(field, after),
    changed:
      changed.has(field) ||
      (field === 'rateSnapshotName' && changed.has('rateId')) ||
      (field === 'payments' && changed.has('amountPaid')),
  }));
}

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  'pending payment': 'Esperando el pago',
  'pending approval': 'Esperando aprobación',
  confirmed: 'Confirmada',
  'checked in': 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  'no show': 'No se presentó',
};

function reservationStatusLabel(value: string): string {
  return RESERVATION_STATUS_LABELS[value] ?? value;
}

const REFUND_STATUS_LABELS: Record<string, string> = {
  none: 'Sin reembolso',
  pending: 'En curso',
  refunded: 'Reembolsado',
  partial: 'Reembolso parcial',
  failed: 'Falló',
};

function refundStatusLabel(value: string): string {
  return REFUND_STATUS_LABELS[value] ?? value;
}

type MetadataEntry = { key: string; value: string };

function formatMetadataValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    if (
      key.toLowerCase().includes('amount') ||
      key === 'delta' ||
      key === 'refundArs'
    ) {
      return fmtMoney0(value);
    }
    if (key === 'confidence') return `${Math.round(value * 100)}%`;
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') {
    if (/At$/.test(key) || key.toLowerCase().includes('date')) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return fmtDateTimeAr(value);
    }
    return value.replaceAll('_', ' ');
  }
  return JSON.stringify(value, null, 2);
}

const GENERIC_METADATA_LABELS: Record<string, string> = {
  amount: 'Importe',
  archivedAt: 'Archivado',
  chargedAmount: 'Cobrado',
  confidence: 'Confianza',
  delta: 'Diferencia',
  invoiceId: 'Factura',
  normalizedText: 'Patente normalizada',
  qualityStatus: 'Calidad',
  reason: 'Razón',
  status: 'Estado',
  suggestedAmount: 'Sugerido',
  ticketNumber: 'Ticket',
};

function metadataEntry(
  metadata: Record<string, unknown>,
  key: string,
  label: string,
): MetadataEntry | null {
  if (!(key in metadata)) return null;
  return { key: label, value: formatMetadataValue(key, metadata[key]) };
}

function compactEntries(entries: Array<MetadataEntry | null>): MetadataEntry[] {
  return entries.filter((entry): entry is MetadataEntry => entry !== null);
}

export function metadataEntries(row: AuditRow): MetadataEntry[] {
  const metadata = row.metadata;

  if (row.action === 'entry.deleted') return [];

  if (row.action === 'arca_account.certificate_expired') {
    return compactEntries([
      metadataEntry(metadata, 'expiresAt', 'Vencimiento'),
      metadataEntry(metadata, 'status', 'Estado'),
    ]);
  }

  if (row.action === 'arca_account.renewal_prepared') {
    return compactEntries([
      metadataEntry(metadata, 'expiresAt', 'Vencimiento actual'),
      metadataEntry(metadata, 'renewalDueAt', 'Renovar antes de'),
      metadataEntry(metadata, 'status', 'Estado'),
    ]);
  }

  if (
    row.action === 'mp_account.link_failed' ||
    row.action === 'mp_account.token_expired' ||
    row.action === 'payment_intent.cancel_mp_failed' ||
    row.action === 'payment_intent.refunded'
  ) {
    return compactEntries([
      metadataEntry(metadata, 'amount', 'Importe'),
      metadataEntry(metadata, 'status', 'Estado'),
      metadataEntry(metadata, 'reason', 'Razón'),
      metadataEntry(metadata, 'error', 'Error'),
      metadataEntry(metadata, 'paymentIntentId', 'Intento de pago'),
      metadataEntry(metadata, 'orderId', 'Orden Mercado Pago'),
    ]);
  }

  if (isReservationAction(row.action)) {
    const entries = compactEntries([
      metadataEntry(metadata, 'vehiclePlate', 'Patente'),
      metadataEntry(metadata, 'entryAt', 'Ingreso reservado'),
      metadataEntry(metadata, 'previousStatus', 'Estado anterior'),
      reservationReason(metadata)
        ? { key: 'Motivo', value: reservationReason(metadata) }
        : null,
      metadataEntry(metadata, 'refundArs', 'Reembolso'),
      metadataEntry(metadata, 'refundStatus', 'Estado del reembolso'),
      metadataEntry(metadata, 'refundError', 'Error del reembolso'),
      metadataEntry(metadata, 'attempt', 'Intento'),
    ]);
    return entries.map((entry) =>
      entry.key === 'Estado anterior'
        ? { ...entry, value: reservationStatusLabel(entry.value) }
        : entry.key === 'Estado del reembolso'
          ? { ...entry, value: refundStatusLabel(entry.value) }
          : entry,
    );
  }

  return Object.entries(metadata)
    .filter(
      ([key]) => !key.endsWith('Id') && key !== 'before' && key !== 'after',
    )
    .map(([key, value]) => ({
      key: GENERIC_METADATA_LABELS[key] ?? key,
      value: formatMetadataValue(key, value),
    }));
}

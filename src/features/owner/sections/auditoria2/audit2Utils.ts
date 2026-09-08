import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import type { AuditEvent, AuditSeverity } from '../../services/audit';

export type AuditActionKind =
  | 'entry.corrected'
  | 'entry.undercharged'
  | 'other';

export type AuditOrigin = 'history' | 'operational_exit' | 'unknown';

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

export type Audit2Row = {
  id: string;
  action: string;
  actionLabel: string;
  actionKind: AuditActionKind;
  actorName: string;
  actorRole: string;
  cashSessionId: string;
  changedFields: string[];
  createdAt: string;
  createdAtLocalDate: string;
  entityId: string | null;
  entityType: string;
  impactAmount: number | null;
  metadata: Record<string, unknown>;
  moneyImpact: string;
  origin: AuditOrigin;
  originLabel: string;
  plate: string;
  reason: string;
  searchText: string;
  severity: AuditSeverity;
  summary: string;
  ticketNumber: string;
};

export type AuditComparisonRow = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
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
  rateSnapshotHourPriceArs: 'Precio por hora',
  rateSnapshotStayPriceArs: 'Estadía',
  rateSnapshotFractionPriceArs: 'Fracción',
  payments: 'Pagos',
};

const DISPLAY_FIELDS: Array<keyof EntrySnapshot> = [
  'plate',
  'enteredAt',
  'leftAt',
  'rateSnapshotName',
  'amountPaid',
  'payments',
];

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
  if (origin === 'history' || origin === 'operational_exit') return origin;
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

export function actionKindFor(action: string): AuditActionKind {
  if (action === 'entry.corrected') return 'entry.corrected';
  if (action === 'entry.undercharged') return 'entry.undercharged';
  return 'other';
}

export function actionLabelFor(action: string): string {
  if (action === 'entry.corrected') return 'Corrección de estadía';
  if (action === 'entry.undercharged') return 'Cobro menor al sugerido';
  return action;
}

export function originLabelFor(origin: AuditOrigin): string {
  if (origin === 'history') return 'Historial';
  if (origin === 'operational_exit') return 'Panel operativo';
  return 'Sin origen';
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
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
  const labels = changedFields.map(fieldLabel);
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
  if (action === 'entry.undercharged') {
    const delta = readNumber(metadata, 'delta');
    return {
      label: delta === null ? '-' : `Diferencia ${fmtMoney0(delta)}`,
      amount: delta,
    };
  }

  if (action === 'entry.corrected') {
    const beforeTotal = amountTotal(before);
    const afterTotal = amountTotal(after);
    if (
      beforeTotal !== null &&
      afterTotal !== null &&
      beforeTotal !== afterTotal
    ) {
      return {
        label: `${fmtMoney0(beforeTotal)} -> ${fmtMoney0(afterTotal)}`,
        amount: afterTotal - beforeTotal,
      };
    }
    if (
      paymentListLabel(before.payments) !== paymentListLabel(after.payments)
    ) {
      return { label: 'Pagos modificados', amount: 0 };
    }
  }

  return { label: '-', amount: null };
}

export function buildAudit2Row(event: AuditEvent): Audit2Row {
  const metadata = metadataRecord(event.metadata);
  const before = readSnapshot(metadata, 'before');
  const after = readSnapshot(metadata, 'after');
  const changedFields = readStringArray(metadata, 'changedFields');
  const origin = readOrigin(metadata);
  const kind = actionKindFor(event.action);
  const plate = after.plate ?? before.plate ?? readString(metadata, 'plate');
  const ticket =
    after.ticketNumber ??
    before.ticketNumber ??
    readNumber(metadata, 'ticketNumber');
  const moneyImpact = moneyImpactFor(event.action, metadata, before, after);
  const reason = readString(metadata, 'reason');
  const actorRole = readString(metadata, 'actorRole');
  const cashSessionId =
    after.cashSessionId ??
    before.cashSessionId ??
    readString(metadata, 'cashSessionId');
  const summary =
    event.action === 'entry.corrected'
      ? correctionSummary(metadata, before, after, changedFields)
      : event.action === 'entry.undercharged'
        ? underchargeSummary(metadata)
        : actionLabelFor(event.action);

  return {
    id: event.id,
    action: event.action,
    actionLabel: actionLabelFor(event.action),
    actionKind: kind,
    actorName: event.actorName ?? 'Sistema',
    actorRole: actorRole || '-',
    cashSessionId: cashSessionId || '-',
    changedFields,
    createdAt: event.createdAt,
    createdAtLocalDate: dateKeyAr(event.createdAt),
    entityId: event.entityId,
    entityType: event.entityType,
    impactAmount: moneyImpact.amount,
    metadata,
    moneyImpact: moneyImpact.label,
    origin,
    originLabel: originLabelFor(origin),
    plate: plate || '-',
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
      originLabelFor(origin),
    ]
      .filter(Boolean)
      .join(' '),
    severity: event.severity,
    summary,
    ticketNumber:
      ticket === null || ticket === undefined ? '-' : String(ticket),
  };
}

export function buildAudit2Rows(events: AuditEvent[]): Audit2Row[] {
  return events.map(buildAudit2Row);
}

export function correctionComparisons(row: Audit2Row): AuditComparisonRow[] {
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

export function metadataEntries(
  metadata: Record<string, unknown>,
): Array<{ key: string; value: string }> {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value:
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : JSON.stringify(value, null, 2),
  }));
}
